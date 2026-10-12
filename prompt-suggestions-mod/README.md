# prompt-suggestions

A Claude Code mod that shows three suggested next-step prompts as buttons above the prompt box after each answered turn. Pressing a button submits that prompt immediately.

## How it works

- After a main-loop turn ends with an answer, the mod forks the session transcript with one extra model call (`$.model.fork`) asking for three next steps as JSON. Aborted, errored, refused and subagent turns are skipped, and each turn is handled once.
- While the fork runs the band shows a dim "Thinking of next steps…" line.
- Each button shows a short label with hotkeys 1 to 3. Hovering one tints it (blue, bold, on a gray cell) and reveals the fuller prompt in a card above the row. Pressing one clears the row at once and submits that prompt as your own words.
- Any prompt you type clears the buttons too. The `x` button hides the current set; the next answered turn brings a fresh set back.
- `/suggest` regenerates suggestions on demand, which also brings back a hidden band.

## Sharing the band

The band above the prompt is shared with any other mod that draws there. This mod never replaces what is beneath it: it awaits the drawing beneath and appends it under its own row, so a mod that stacks the same way, such as [task-progress](../task-progress-mod), shows alongside the buttons. Which of the two lands on top follows the engine's plugin order.

## Settings

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Turn the mod off without uninstalling it. Shown in the config menu. |

## Layout

- `.claude-plugin/plugin.json` manifest, including `userConfig` and the path to the state contract.
- `hooks/hooks.json` names the hooks module.
- `hooks/register.tsx` the hooks: `session.start`, `prompt.submit`, `turn.complete`, `command.run` for `/suggest`, and `ui.render` on `AbovePrompt`.
- `hooks/parse.ts` the fork prompt and the parser that turns the reply into `{ label, prompt }` items.
- `types/index.d.ts` the `$.state` contract: `suggestions`, `turnId`, `isHidden`, `isLoading`.
- `hooks/*.test.ts(x)` tests run by `claude plugin test`.

## Develop

Load it for one session:

```bash
claude --plugin-dir /Users/timd/Documents/PinHigh/dev/claude-mod/prompt-suggestions-mod
```

Or symlink it into a session's `~/.claude/dev-mods/<session>/` folder and accept the hot-reload prompt; every edit then reloads when the turn ends.

Check it:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

Once the engine has loaded the mod it writes `.claude-plugin/types/`, after which `tsc -p .` type-checks it.

## Install

This mod ships in the [claude-mods](../README.md) repository, whose root is the marketplace. From the repository root:

```bash
./install.sh
```

That installs every mod in the repository at user scope. Once the repository is on GitHub, this mod alone installs from inside a terminal session of Claude Code with:

```
/plugin install prompt-suggestions --marketplace <owner>/<repo>
```
