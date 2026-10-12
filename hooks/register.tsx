import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer, ToolCallResult } from 'claude-code'
import type { TaskProgress } from '../types'
import { barText, etaLabel, formatAge, formatClock, isStale, minutesLeft, parseReport } from './format'

const PLUGIN = 'task-progress'
const TOOL: string = 'mcp__task-progress__report_progress'
const TICK_MS = 60_000
const LINGER_MS = 60_000
const BAR_WIDTH = 20

const task = atom({ plugin: 'task-progress', key: 'task' } as const, null as TaskProgress | null)
const now = atom({ plugin: 'task-progress', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'task-progress', key: 'isHidden' } as const, false)

const INSTRUCTIONS = `# Task progress reports

A progress bar under the prompt box shows the person how a long task is going. Keep it fed with the \`${TOOL}\` tool whenever you run a long task: a coding task with many steps, a deployment, a benchmark, or a performance test that you expect to take more than two minutes.

- Call it once when the task starts, with \`task\` (a short name), \`percent\`, and \`etaMinutes\` (your honest estimate of minutes remaining). Add \`stage\` when the task has recognisable phases.
- Call it again whenever a minute or more has passed since your last report and you have control back, with updated \`percent\` and \`etaMinutes\`. Run long commands in the background and check on them, so you can keep reporting roughly once a minute.
- Call it with \`done: true\` when the task finishes or is abandoned.

Do not report short tasks. Do not announce the reports in your replies.`

/** The minute ticker: runs only while a task is tracked, so idle sessions keep no timer. */
let ticker: Timer | null = null

function startTicker($: EngineInterface): void {
  if (ticker !== null) return
  ticker = $.clock.every(TICK_MS, () => tick($))
}

function stopTicker(): void {
  ticker?.cancel()
  ticker = null
}

async function clearTask($: EngineInterface): Promise<void> {
  stopTicker()
  await update($, task, () => null)
}

async function tick($: EngineInterface): Promise<void> {
  if ((await read($, task)) === null) return stopTicker()
  const at = await $.clock.now()
  await update($, now, () => at)
}

async function clearIfUntouched($: EngineInterface, updatedAt: number): Promise<void> {
  const current = await read($, task)
  if (current !== null && current.updatedAt === updatedAt) await clearTask($)
}

function toolResult(text: string): ToolCallResult {
  return { result: { content: [{ type: 'text', text }], isError: false } }
}

/** Serves `report_progress`: writes the report into state, or refuses a malformed one. */
async function serveReport($: EngineInterface, input: unknown): Promise<ToolCallResult> {
  const parsed = parseReport(input)
  if (!parsed.ok) return { deny: `report_progress: ${parsed.error}.` }
  const report = parsed.value
  if (report.done) {
    await clearTask($)
    return toolResult(`Progress bar cleared for "${report.task}".`)
  }
  const at = await $.clock.now()
  await update($, task, previous => ({
    task: report.task,
    stage: report.stage,
    percent: report.percent,
    etaMinutes: report.etaMinutes,
    startedAt: previous !== null && previous.task === report.task ? previous.startedAt : at,
    updatedAt: at,
  }))
  await update($, now, () => at)
  await update($, isHidden, () => false)
  startTicker($)
  return toolResult(`Progress bar shows "${report.task}" at ${report.percent}%.`)
}

export const register: Register = (on, options) => {
  const isEnabled = options.enabled !== false
  const staleAfterMinutes = typeof options.staleAfterMinutes === 'number' ? options.staleAfterMinutes : 3

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'report_progress',
      description:
        'Reports progress on a long-running task (coding, deployment, benchmark, performance test) for the progress bar under the prompt box. Call at the start, about once a minute while it runs, and with done: true at the end.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Short name of the task, e.g. "Deploy to staging".' },
          percent: { type: 'number', description: 'How far along the task is, 0 to 100.' },
          etaMinutes: { type: 'number', description: 'Estimated minutes remaining.' },
          stage: { type: 'string', description: 'The current phase, e.g. "stage 3 of 5: load test".' },
          done: { type: 'boolean', description: 'True when the task has finished or been abandoned.' },
        },
        required: ['task'],
      },
    })
    await $.command.register({
      name: 'progress',
      description: 'Show the current task progress, or `/progress clear` to remove the bar.',
    })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!isEnabled) return composed
    return {
      sections: [...composed.sections, { id: `${PLUGIN}:instructions`, text: INSTRUCTIONS, scope: 'session' as const }],
    }
  })

  on('tool.call', { tool: /^mcp__task-progress__report_progress$/ }, ($, e) => serveReport($, e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const current = await read($, task)
    if (current === null) return result
    $.clock.after(LINGER_MS, () => clearIfUntouched($, current.updatedAt))
    return result
  })

  on('command.run', { command: 'progress' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await clearTask($)
      return { text: 'Progress bar cleared.' }
    }
    const current = await read($, task)
    if (current === null) return { text: 'No task is being tracked.' }
    const at = await $.clock.now()
    const stage = current.stage === null ? '' : ` · ${current.stage}`
    return { text: `${current.task}${stage}: ${current.percent}%, ${etaLabel(minutesLeft(current, at)) || 'no estimate'}, elapsed ${formatClock(at - current.startedAt)}.` }
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!isEnabled || (await read($, isHidden))) return next(e)
    const current = await read($, task)
    if (current === null) return next(e)
    const at = Math.max(await read($, now), current.updatedAt)
    const { Box, Button, Text } = $.ui.resolve(e)
    const stale = isStale(current, at, staleAfterMinutes)
    const stage = current.stage === null ? '' : ` · ${current.stage}`
    const eta = etaLabel(minutesLeft(current, at))
    const age = stale ? `no update for ${Math.floor((at - current.updatedAt) / 60_000)} min` : formatAge(at - current.updatedAt)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text dimColor>◷</Text>
          <Text bold={!stale} dimColor={stale}>{`${current.task}${stage}`}</Text>
          <Box flexGrow={1} />
          {eta === '' ? null : <Text key="eta" dimColor={stale}>{eta}</Text>}
          <Button key="hide" label="x" plain onPress={() => update($, isHidden, () => true)} />
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text color={stale ? undefined : 'blue'} dimColor={stale}>{barText(current.percent, BAR_WIDTH)}</Text>
          <Text dimColor={stale}>{`${current.percent}%`}</Text>
          <Text dimColor>{`elapsed ${formatClock(at - current.startedAt)}`}</Text>
          <Text dimColor>{age}</Text>
        </Box>
      </Box>
    )
  })
}
