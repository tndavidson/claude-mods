# task-progress

A Claude Code mod that draws a progress bar and estimated time remaining under the prompt box while a long task runs: a multi-step coding task, a deployment, a benchmark, or a performance test.

```
◷ Benchmark · stage 3 of 5: load test                      ~6 min left  x
████████████░░░░░░░░ 58%  elapsed 8:12  updated 41s ago
```

## How it works

- The mod registers a tool, `report_progress`, and adds a short section to the system prompt asking the model to call it when a task expected to take more than two minutes starts, again whenever a minute or more has passed and the model has control back, and once more with `done: true` at the end.
- Each report carries `task`, `percent`, `etaMinutes`, and an optional `stage`.
- The mod owns the clock. Once a minute it counts the estimate down from the last report and advances the elapsed and "updated N ago" readings. It never invents progress: the percent only moves when the model reports.
- Past `staleAfterMinutes` without a report the bar dims and reads "no update for N min".
- The bar clears on `done: true`, on `/progress clear`, or a minute after a turn ends with no new report. The `x` button hides it until the next report.

A model cannot call anything while a single blocking command runs, so reports arrive when control returns. Long commands run in the background and polled give the steadiest cadence.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| `enabled` | `true` | Draw the bar and add the system prompt section. |
| `staleAfterMinutes` | `3` | Minutes without a report before the bar dims. |

## Commands

- `/progress` prints the tracked task, percent, estimate, and elapsed time.
- `/progress clear` removes the bar.

## Where it draws

The bar sits in the band directly above the prompt box, on the terminal and desktop surfaces. The desktop never hands the hint line under the prompt to mods, and its status line is a narrow truncated slot, so the band is the one place a two-row bar fits.

The mod stacks itself above whatever else draws in the band: it awaits the drawing beneath and appends it under its own rows. A mod that shares the band the same way, such as [prompt-suggestions](../prompt-suggestions-mod), shows alongside it. Which of the two lands on top follows the engine's plugin order.

## Develop

- Run from a checkout: `claude --plugin-dir /path/to/task-progress-mod`, or symlink the folder into a session's `~/.claude/dev-mods/<session-id>/` folder with hot reloading enabled.
- Validate: `claude plugin validate .claude-plugin/plugin.json`
- Test: `claude plugin test .`
- Type-check after the mod has loaded once: `npx -y -p typescript@latest tsc -p .` (TypeScript 7; the 5.x compiler reports a spurious deep-instantiation error on `tool.call` matchers)

## Install

This mod ships in the [claude-mods](../README.md) repository, whose root is the marketplace. From the repository root:

```bash
./install.sh
```

That installs every mod in the repository at user scope, and updates the ones already installed. After a change, bump `version` in `.claude-plugin/plugin.json`, re-run it, then `/reload-plugins` in open sessions: sessions load the installed copy rather than this folder, and the update only copies when the version has moved. Once the repository is on GitHub, this mod alone installs from inside a terminal session of Claude Code with:

```
/plugin install task-progress --marketplace <owner>/<repo>
```
