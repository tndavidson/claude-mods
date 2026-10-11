import { describe, expect, test } from 'claude-code/testing'

import { MAX_LABEL_LENGTH, MAX_SUGGESTIONS, parseSuggestions } from './parse'

const three = [
  { label: 'Add unit tests', prompt: 'Add unit tests for the parser.' },
  { label: 'Write the README', prompt: 'Write a README describing the mod.' },
  { label: 'Publish it', prompt: 'Publish the mod to a marketplace.' },
]

describe('parseSuggestions', () => {
  test('parses a clean JSON array', () => {
    expect(parseSuggestions(JSON.stringify(three))).toEqual(three)
  })

  test('strips a code fence and surrounding prose', () => {
    const text = 'Here you go:\n```json\n' + JSON.stringify(three) + '\n```\nLet me know.'
    expect(parseSuggestions(text)).toEqual(three)
  })

  test('returns nothing for garbage', () => {
    expect(parseSuggestions('no suggestions here')).toEqual([])
    expect(parseSuggestions('[not json')).toEqual([])
    expect(parseSuggestions('{"label": "x", "prompt": "y"}')).toEqual([])
  })

  test('drops items missing a label or prompt and trims whitespace', () => {
    const text = JSON.stringify([
      { label: '  Add tests  ', prompt: ' Add tests. ' },
      { label: 'No prompt' },
      { prompt: 'No label' },
      { label: '', prompt: 'Empty label' },
      { label: 'Ship it', prompt: 'Ship it now.' },
      42,
      null,
    ])
    expect(parseSuggestions(text)).toEqual([
      { label: 'Add tests', prompt: 'Add tests.' },
      { label: 'Ship it', prompt: 'Ship it now.' },
    ])
  })

  test('returns nothing for a single usable item', () => {
    expect(parseSuggestions(JSON.stringify([three[0]]))).toEqual([])
  })

  test('keeps at most MAX_SUGGESTIONS items', () => {
    const five = [...three, { label: 'Four', prompt: 'Four.' }, { label: 'Five', prompt: 'Five.' }]
    expect(parseSuggestions(JSON.stringify(five))).toHaveLength(MAX_SUGGESTIONS)
  })

  test('cuts long labels with an ellipsis', () => {
    const long = 'A'.repeat(MAX_LABEL_LENGTH + 20)
    const [first] = parseSuggestions(JSON.stringify([{ label: long, prompt: 'p' }, three[1]]))
    expect(first?.label.length).toBe(MAX_LABEL_LENGTH)
    expect(first?.label.endsWith('…')).toBe(true)
  })
})
