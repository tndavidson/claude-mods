import type { Suggestion } from '../types'

/** How many suggestions the band shows at most. */
export const MAX_SUGGESTIONS = 3

/** Longest label drawn on a button; longer ones are cut with an ellipsis. */
export const MAX_LABEL_LENGTH = 40

/**
 * The one user message `$.model.fork` appends to the session's transcript to
 * ask for next steps. Asks for JSON only so `parseSuggestions` has little to
 * strip.
 */
export const SUGGESTION_PROMPT = [
  'Based on this conversation so far, suggest exactly three next steps I (the user) might ask you for.',
  'Phrase each as something I would type to you, not something you would do.',
  'Reply with a JSON array only, no prose and no code fence, where each item is',
  '{"label": "<3 to 6 word imperative label>", "prompt": "<one full sentence I would send>"}.',
].join(' ')

/**
 * Pulls a JSON array of `{ label, prompt }` out of a model reply.
 *
 * Tolerates a code fence and prose around the array. Drops items that lack a
 * non-empty string `label` or `prompt`, trims whitespace, cuts long labels to
 * `MAX_LABEL_LENGTH`, and keeps at most `MAX_SUGGESTIONS`. Returns an empty
 * array for anything malformed or for fewer than two usable items, so the
 * caller draws nothing rather than a half-empty row.
 */
export function parseSuggestions(text: string): Suggestion[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const items: Suggestion[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue
    const { label, prompt } = item as Record<string, unknown>
    if (typeof label !== 'string' || typeof prompt !== 'string') continue
    const cleanLabel = label.trim()
    const cleanPrompt = prompt.trim()
    if (cleanLabel === '' || cleanPrompt === '') continue
    items.push({ label: truncate(cleanLabel, MAX_LABEL_LENGTH), prompt: cleanPrompt })
    if (items.length === MAX_SUGGESTIONS) break
  }

  return items.length < 2 ? [] : items
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}
