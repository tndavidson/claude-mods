import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const three = [
  { label: 'Add unit tests', prompt: 'Add unit tests for the parser.' },
  { label: 'Write the README', prompt: 'Write a README describing the mod.' },
  { label: 'Publish it', prompt: 'Publish the mod to a marketplace.' },
]

const answered = {
  isAnswered: true as const,
  text: JSON.stringify(three),
  usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
}

/** Stands for the engine's own band: what shows when the mod yields with next(e). */
const engineBand = ($: Parameters<TestBody>[0], on: Parameters<TestBody>[1]) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine">engine band</Text>
  })

const band = (isWorking: boolean) => ({
  hasSurvey: false,
  isWorking,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
})

const turn = (overrides: Record<string, unknown> = {}) => ({
  reason: 'answer' as const,
  answer: 'Done.',
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  ...overrides,
})

describe('prompt-suggestions', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`draws three buttons with prompt cards after an answered turn and submits on press (${surface})`, async ($, on) => {
      let forks = 0
      const submitted: string[] = []
      on('model.fork', () => {
        forks += 1
        return { value: answered }
      })
      on('turn.complete', () => ({ text: 'Done.' }))
      engineBand($, on)
      on('prompt.submit', (_, e) => {
        submitted.push(e.text)
        return { text: e.text }
      })

      await $.turn.complete(turn())
      expect(forks).toBe(1)

      const ui = await $.ui.mount({
        plugin: 'prompt-suggestions',
        surface,
        component: 'AbovePrompt',
        props: band(false),
      })
      expect(await ui.findAll({ type: 'Button' })).toHaveLength(4)
      expect((await ui.find({ key: 's0' }))?.text).toBe('Add unit tests')

      for (const s of three) {
        expect(await ui.find({ type: 'Text', text: s.prompt })).toBeDefined()
      }
      // The band is shared: the drawing beneath stays under the buttons.
      expect((await ui.find({ type: 'Text', text: 'engine band' }))?.text).toBe('engine band')

      await ui.press({ key: 's1' })
      expect(submitted).toEqual([three[1]?.prompt])
    })
  }

  test('generates once per turn and skips subagent, aborted and refused turns', async ($, on) => {
    let forks = 0
    on('model.fork', () => {
      forks += 1
      return { value: answered }
    })
    on('turn.complete', () => ({ text: '' }))

    await $.turn.complete(turn())
    await $.turn.complete(turn())
    expect(forks).toBe(1)

    await $.turn.complete(turn({ turnId: 't2', agentId: 'agent-1' }))
    await $.turn.complete(turn({ turnId: 't3', reason: 'aborted', isAborted: true }))
    await $.turn.complete(turn({ turnId: 't4', reason: 'error' }))
    expect(forks).toBe(1)
  })

  test('clears suggestions when a prompt is submitted', async ($, on) => {
    on('model.fork', () => ({ value: answered }))
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', (_, e) => ({ text: e.text }))
    engineBand($, on)

    await $.turn.complete(turn())
    await $.prompt.submit({ text: 'next question', wait: false, origin: { kind: 'composer' } })

    const ui = await $.ui.mount({
      plugin: 'prompt-suggestions',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: band(true),
    })
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
  })

  test('the x button hides the band and /suggest brings it back', async ($, on) => {
    on('model.fork', () => ({ value: answered }))
    on('turn.complete', () => ({ text: '' }))
    engineBand($, on)

    await $.turn.complete(turn())
    const ui = await $.ui.mount({
      plugin: 'prompt-suggestions',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: band(false),
    })
    await ui.press({ key: 'hide' })
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)

    const result = await $.command.run({
      command: 'suggest',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
    expect(result.text).toBe('Suggested 3 next steps.')
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(4)
  })

  test('does nothing when disabled', { options: { enabled: false } }, async ($, on) => {
    let forks = 0
    on('model.fork', () => {
      forks += 1
      return { value: answered }
    })
    on('turn.complete', () => ({ text: '' }))

    await $.turn.complete(turn())
    expect(forks).toBe(0)
  })
})
