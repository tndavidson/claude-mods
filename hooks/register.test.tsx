import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

type On = Parameters<TestBody>[1]

const MIN = 60_000
const TOOL = 'mcp__task-progress__report_progress'
const SURFACES = ['terminal', 'desktop'] as const
const COMPOSE = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const
const RUN = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }

const hint = { isDraft: false, isWorking: true, hint: '? for shortcuts' }

function engineHint(on: On) {
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine">engine hint</Text>
  })
}

async function report($: Engine, input: Record<string, unknown>) {
  return $.tool.call({ tool: TOOL, ...input } as never)
}

function mount($: Engine, surface: (typeof SURFACES)[number] = 'terminal') {
  return $.ui.mount({ plugin: 'task-progress', surface, component: 'PromptHint', props: hint })
}

async function shown(ui: Awaited<ReturnType<typeof mount>>, text: string) {
  return (await ui.find({ type: 'Text', text }))?.text
}

async function isDrawn(ui: Awaited<ReturnType<typeof mount>>) {
  return (await ui.find({ key: 'hide' })) !== undefined
}

describe('task-progress', () => {
  for (const surface of SURFACES) {
    test(`draws the bar after a report on ${surface}`, async ($, on) => {
      mock.clock(on, { now: 100 * MIN })
      engineHint(on)
      await report($, { task: 'Benchmark', stage: 'load test', percent: 58, etaMinutes: 6 })
      const ui = await mount($, surface)
      expect(await shown(ui, 'Benchmark · load test')).toBe('Benchmark · load test')
      expect(await shown(ui, '~6 min left')).toBe('~6 min left')
      expect(await shown(ui, '████████████░░░░░░░░')).toBe('████████████░░░░░░░░')
      expect(await shown(ui, '58%')).toBe('58%')
      expect(await shown(ui, 'elapsed 0:00')).toBe('elapsed 0:00')
      expect(await shown(ui, 'updated 0s ago')).toBe('updated 0s ago')
      expect(await isDrawn(ui)).toBe(true)
      await ui.unmount()
    })
  }

  test('passes to the engine with no task', async ($, on) => {
    mock.clock(on)
    engineHint(on)
    const ui = await mount($)
    expect(await isDrawn(ui)).toBe(false)
    await ui.unmount()
  })

  test('counts the estimate down each minute and keeps the start time', async ($, on) => {
    const clock = mock.clock(on, { now: 100 * MIN })
    engineHint(on)
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    const ui = await mount($)
    await clock.advance(2 * MIN)
    expect(await shown(ui, '~3 min left')).toBe('~3 min left')
    expect(await shown(ui, 'elapsed 2:00')).toBe('elapsed 2:00')
    expect(await shown(ui, 'updated 2 min ago')).toBe('updated 2 min ago')
    await report($, { task: 'Deploy', percent: 70, etaMinutes: 1 })
    expect(await shown(ui, '~1 min left')).toBe('~1 min left')
    expect(await shown(ui, 'elapsed 2:00')).toBe('elapsed 2:00')
    expect(await shown(ui, '70%')).toBe('70%')
    await ui.unmount()
  })

  test('dims and says so once a report is stale', async ($, on) => {
    const clock = mock.clock(on, { now: 100 * MIN })
    engineHint(on)
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    const ui = await mount($)
    await clock.advance(4 * MIN)
    expect(await shown(ui, 'no update for 4 min')).toBe('no update for 4 min')
    await ui.unmount()
  })

  test('done clears the bar, as does /progress clear', async ($, on) => {
    mock.clock(on)
    engineHint(on)
    const ui = await mount($)
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    expect(await isDrawn(ui)).toBe(true)
    await report($, { task: 'Deploy', done: true })
    expect(await isDrawn(ui)).toBe(false)
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    expect(await isDrawn(ui)).toBe(true)
    const cleared = await $.command.run({ command: 'progress', args: 'clear', ...RUN })
    expect(cleared.text).toBe('Progress bar cleared.')
    expect(await isDrawn(ui)).toBe(false)
    await ui.unmount()
  })

  test('/progress reports the state', async ($, on) => {
    mock.clock(on, { now: 100 * MIN })
    const none = await $.command.run({ command: 'progress', args: '', ...RUN })
    expect(none.text).toBe('No task is being tracked.')
    await report($, { task: 'Benchmark', stage: 'warm up', percent: 10, etaMinutes: 9 })
    const some = await $.command.run({ command: 'progress', args: '', ...RUN })
    expect(some.text).toBe('Benchmark · warm up: 10%, ~9 min left, elapsed 0:00.')
  })

  test('x hides until the next report', async ($, on) => {
    mock.clock(on)
    engineHint(on)
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    const ui = await mount($, 'desktop')
    await ui.press({ key: 'hide' })
    expect(await isDrawn(ui)).toBe(false)
    await report($, { task: 'Deploy', percent: 40, etaMinutes: 3 })
    expect(await isDrawn(ui)).toBe(true)
    await ui.unmount()
  })

  test('clears a minute after the turn ends unless a new report lands', async ($, on) => {
    const clock = mock.clock(on, { now: 100 * MIN })
    engineHint(on)
    on('turn.complete', () => ({ text: '' }))
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    const ui = await mount($)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1' })
    await clock.advance(30_000)
    await report($, { task: 'Deploy', percent: 60, etaMinutes: 2 })
    await clock.advance(31_000)
    expect(await isDrawn(ui)).toBe(true)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't2' })
    await clock.advance(MIN)
    expect(await isDrawn(ui)).toBe(false)
    await ui.unmount()
  })

  test('rejects a bad report', async ($, on) => {
    mock.clock(on)
    const bad = await report($, { percent: 5 })
    expect(bad.deny).toContain('task must be a non-empty string')
  })

  test('adds the instructions to the system prompt', async ($, on) => {
    mock.clock(on)
    on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' as const }] }))
    const { sections } = await $.prompt.compose(COMPOSE)
    expect(sections.map(s => s.id)).toEqual(['intro', 'task-progress:instructions'])
  })

  test('does nothing when disabled', { options: { enabled: false } }, async ($, on) => {
    mock.clock(on)
    engineHint(on)
    on('prompt.compose', () => ({ sections: [] }))
    await report($, { task: 'Deploy', percent: 20, etaMinutes: 5 })
    const ui = await mount($)
    expect(await isDrawn(ui)).toBe(false)
    const { sections } = await $.prompt.compose(COMPOSE)
    expect(sections).toEqual([])
    await ui.unmount()
  })
})
