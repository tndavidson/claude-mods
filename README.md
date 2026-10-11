# prompt-suggestions

A Claude Code mod that shows three suggested next-step prompts as buttons above the prompt box after each answered turn. Pressing a button submits that prompt immediately.

## How it works

- After a main-loop turn ends with an answer, the mod forks the session transcript with one extra model call (`$.model.fork`) asking for three next steps as JSON. Aborted, errored, refused and subagent turns are skipped, and each turn is handled once.
- While the fork runs the band shows a dim "Thinking of next steps…" line.
- Each button shows a short label with hotkeys 1 to 3. Pressing one submits the fuller prompt behind it as your own words.
- Any prompt you send clears the buttons. The `x` button hides the band until you run `/suggest`.
- `/suggest` unhides the band and regenerates suggestions on demand.

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

This repository is its own marketplace: `.claude-plugin/marketplace.json` lists the mod with the repository root as its source. From a terminal session of Claude Code:

```
/plugin install prompt-suggestions --marketplace <owner>/<repo>
```

Answer `y` to add the marketplace, pick a scope (user is first), and set the `enabled` option if asked. The mod is active in that session at once and, at the user scope, in every later session, including the desktop app's Code tab.

To install from a local clone instead of GitHub, add the folder as a marketplace and install from it:

```bash
claude plugin marketplace add /path/to/prompt-suggestions-mod
```

```bash
claude plugin install prompt-suggestions@prompt-suggestions
```
