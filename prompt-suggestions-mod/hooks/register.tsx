import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

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

/**
 * A suggestion was pressed: the row goes at once, then the prompt is
 * submitted as the person's own. Clearing here rather than in the
 * `prompt.submit` hook alone keeps the band from lingering while the
 * submission is queued behind a running turn.
 */
async function pick($: EngineInterface, prompt: string): Promise<void> {
  await update($, suggestions, () => [])
  await $.prompt.submit({ text: prompt, asUser: true })
}

/** True for a drawing another hook or the engine handed back, as opposed to nothing drawn. */
function isElement(value: unknown): value is RenderElement {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'
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

    const items = await read($, suggestions)
    const loading = await read($, isLoading)
    if (!loading && items.length === 0) return next(e)

    // The band is shared: whatever draws beneath (another mod's rows, or
    // nothing) is appended under this mod's own row rather than replaced.
    const beneath = await next(e)
    const under = isElement(beneath) ? beneath : null

    const { Box, Button, Text } = $.ui.resolve(e)

    if (loading) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text dimColor>Thinking of next steps…</Text>
          </Box>
          {under}
        </Box>
      )
    }

    // Each button sits in a keyed Box, which scopes hover: the card inside it
    // is drawn hidden and revealed by the surface while the pointer is over the
    // button, placed above the row so nothing in it moves; the button's own
    // label lights at the same time. The row never wraps.
    // The card sizes to its one line of text, so the surface measures it in its
    // own font; only a prompt wider than the band is given the band's width and
    // wraps inside it.
    const bandColumns = Math.max(20, e.props.bodyColumns)
    const cardWidth = (prompt: string) =>
      prompt.length + CARD_CHROME_COLUMNS > bandColumns ? bandColumns : undefined

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="nowrap" alignItems="center">
          {items.map((s, i) => (
            <Box key={`h${i}`} flexShrink={0} hover={{ backgroundColor: 'gray' }}>
              <Button
                key={`s${i}`}
                label={s.label}
                hotkey={String(i + 1)}
                hover={{ color: 'blue', bold: true }}
                onPress={() => pick($, s.prompt)}
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
          <Box key="hide-box" flexShrink={0}>
            <Button
              key="hide"
              label="x"
              plain
              dimColor
              hover={{ color: 'blue' }}
              onPress={() => update($, isHidden, () => true)}
            />
          </Box>
        </Box>
        {under}
      </Box>
    )
  })
}
