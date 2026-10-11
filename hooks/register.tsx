import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Suggestion } from '../types'
import { SUGGESTION_PROMPT, parseSuggestions } from './parse'

/** The suggestions the band draws; empty when there is nothing to show. */
const suggestions = atom(
  { plugin: 'prompt-suggestions', key: 'suggestions' } as const,
  [] as Suggestion[],
)
/** The last main-loop turn suggestions were generated for, so a reload does not repeat it. */
const lastTurnId = atom({ plugin: 'prompt-suggestions', key: 'turnId' } as const, null as string | null)
/** Set by the band's x button; cleared by /suggest. */
const isHidden = atom({ plugin: 'prompt-suggestions', key: 'isHidden' } as const, false)
/** Columns the hover card adds around its one line of text: border and padding. */
const CARD_CHROME_COLUMNS = 4
/** True while a fork is in flight, so the band shows a waiting line. */
const isLoading = atom({ plugin: 'prompt-suggestions', key: 'isLoading' } as const, false)

/**
 * Asks the model for next steps over the session's own transcript and
 * stores what parses. Resolves to the stored suggestions.
 */
async function generate($: EngineInterface): Promise<Suggestion[]> {
  await update($, suggestions, () => [])
  await update($, isLoading, () => true)
  try {
    const reply = await $.model.fork({ prompt: SUGGESTION_PROMPT })
    const items = reply.isAnswered ? parseSuggestions(reply.text) : []
    await update($, suggestions, () => items)
    return items
  } finally {
    await update($, isLoading, () => false)
  }
}


export const register: Register = (on, options) => {
  const isEnabled = options.enabled !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'suggest',
      description: 'Suggest next-step prompts as buttons above the prompt box.',
    })
    return next(e)
  })

  // Any prompt starts a new turn: stale buttons go at once.
  on('prompt.submit', async ($, e, next) => {
    await update($, suggestions, () => [])
    await update($, isLoading, () => false)
    return next(e)
  })

  // After a main-loop turn that ended with an answer, generate once per turn.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!isEnabled || e.reason !== 'answer' || e.agentId !== undefined) return result
    if ((await read($, lastTurnId)) === e.turnId) return result
    await update($, lastTurnId, () => e.turnId)
    await generate($)
    return result
  })

  // /suggest brings the band back and regenerates on demand.
  on('command.run', { command: 'suggest' }, async $ => {
    if (!isEnabled) return { text: 'prompt-suggestions is disabled in its settings.' }
    await update($, isHidden, () => false)
    const items = await generate($)
    return {
      text: items.length === 0 ? 'No suggestions yet. Ask something first.' : `Suggested ${items.length} next steps.`,
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isEnabled || e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)

    if (await read($, isLoading)) {
      return (
        <Box>
          <Text dimColor>Thinking of next steps…</Text>
        </Box>
      )
    }

    const items = await read($, suggestions)
    if (items.length === 0) return next(e)

    // Each button sits in a keyed Box, which scopes hover: the card inside it
    // is drawn hidden and revealed by the surface while the pointer is over the
    // button, placed above the row so nothing in it moves. The row never wraps.
    // The card sizes to its one line of text, so the surface measures it in its
    // own font; only a prompt wider than the band is given the band's width and
    // wraps inside it.
    const bandColumns = Math.max(20, e.props.bodyColumns)
    const cardWidth = (prompt: string) =>
      prompt.length + CARD_CHROME_COLUMNS > bandColumns ? bandColumns : undefined

    return (
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center">
        {items.map((s, i) => (
          <Box key={`h${i}`} flexShrink={0}>
            <Button
              key={`s${i}`}
              label={s.label}
              hotkey={String(i + 1)}
              onPress={() => $.prompt.submit({ text: s.prompt, asUser: true })}
            />
            <Box
              position="absolute"
              bottom={1}
              left={0}
              width={cardWidth(s.prompt)}
              display="none"
              hover={{ display: 'flex' }}
              borderStyle="round"
              paddingX={1}
            >
              <Text wrap="wrap">{s.prompt}</Text>
            </Box>
          </Box>
        ))}
        <Button key="hide" label="x" plain onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
