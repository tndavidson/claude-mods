# claude-mods

Mods for [Claude Code](https://claude.com/claude-code), one per folder. Each folder is a plugin of function hooks that changes the Claude Code interface. The root of this repository is a plugin marketplace that installs them.

| Mod | What it does |
| --- | --- |
| [prompt-suggestions](prompt-suggestions-mod/) | Suggests three next-step prompts as buttons above the prompt box after each turn. Press one, or hotkeys 1 to 3, to submit it. `/suggest` regenerates them on demand. |
| [task-progress](task-progress-mod/) | Shows a progress bar and estimated minutes remaining above the prompt box while a long task runs. `/progress` prints the current state, `/progress clear` removes the bar. |

Both draw in the band above the prompt and share it: each stacks itself above whatever the other drew.

## Requirements

- Claude Code with plugin support: the `claude` CLI, the desktop app, or an IDE extension. Both mods draw on the terminal and desktop surfaces.
- `git`, so Claude Code can fetch the marketplace from GitHub (not needed when installing from a local clone).
- `python3` is needed only by the local `install.sh` script, which reads the marketplace manifest with it.

## Install

There are three ways to install. Pick one.

### 1. From GitHub, inside a Claude Code session (recommended)

Run these as slash commands at the Claude Code prompt. The first registers this repository as a marketplace named `claude-mods`; the next two install each mod from it.

```
/plugin marketplace add tndavidson/claude-mods
/plugin install prompt-suggestions@claude-mods
/plugin install task-progress@claude-mods
```

Each `/plugin install` asks for a scope:

| Scope | Where the mod loads |
| --- | --- |
| `user` | Every Claude Code session on this machine. The usual choice. |
| `project` | Sessions in the current repository, recorded in `.claude/settings.json` so teammates get it too. |
| `local` | Sessions in the current repository, for you only (`.claude/settings.local.json`). |

Then reload. Sessions already open pick the mods up with:

```
/reload-plugins
```

New sessions load them as they start. You can confirm with `/plugin list`, which should show both mods as enabled.

### 2. From GitHub, with the `claude` CLI

The same steps from a shell, for scripting or a machine you are setting up:

```bash
claude plugin marketplace add tndavidson/claude-mods
```

```bash
claude plugin install prompt-suggestions@claude-mods --scope user
```

```bash
claude plugin install task-progress@claude-mods --scope user
```

Install only the one you want if you do not want both. Use `--scope project` or `--scope local` to narrow where a mod loads.

### 3. From a local clone, with `install.sh`

Clone the repository and run the script from its root:

```bash
git clone https://github.com/tndavidson/claude-mods.git
```

```bash
cd claude-mods && ./install.sh
```

The script registers the clone as the `claude-mods` marketplace (or refreshes the registration if it already exists), installs each mod the marketplace lists, and updates any that were already installed. `./install.sh --scope project` or `--scope local` narrows where they load. Re-run it after every change you want other sessions to see, then `/reload-plugins` in sessions already open.

A clone installed this way is read live from its folder, so edits take effect on the next `/reload-plugins` or session start. This is the path to use when developing the mods.

## Updating

Mods installed from GitHub update with:

```
/plugin marketplace update claude-mods
/plugin update prompt-suggestions@claude-mods
/plugin update task-progress@claude-mods
```

or from a shell:

```bash
claude plugin marketplace update claude-mods && claude plugin update prompt-suggestions@claude-mods && claude plugin update task-progress@claude-mods
```

An update only copies a mod when the `version` in its `.claude-plugin/plugin.json` has moved; a mod whose version has not changed is left alone. Follow an update with `/reload-plugins`.

## Settings

Each mod has a `userConfig` block that shows up in the plugin config menu (`/plugin`, then the mod). The defaults work without changes.

| Mod | Setting | Default | Effect |
| --- | --- | --- | --- |
| prompt-suggestions | `enabled` | `true` | Show the suggestion buttons. Turn off to keep the mod installed but silent. |
| task-progress | `enabled` | `true` | Draw the progress bar and add its section to the system prompt. |
| task-progress | `staleAfterMinutes` | `3` | Minutes without a progress report before the bar dims and says so. |

## Uninstall

```
/plugin uninstall prompt-suggestions@claude-mods
/plugin uninstall task-progress@claude-mods
/plugin marketplace remove claude-mods
```

The same commands work from a shell as `claude plugin uninstall …` and `claude plugin marketplace remove claude-mods`.

## Troubleshooting

- **The band does not appear after installing.** Run `/reload-plugins`, or start a new session. Installed mods load at session start.
- **`/plugin list` shows the mod but nothing draws.** Check the mod's `enabled` setting in the config menu, and check that you are on the terminal or desktop surface; the band above the prompt is not drawn on every surface.
- **An update says the mod is already at the latest version** but you expected a change. The installed copy is keyed by `version` in the mod's `plugin.json`. The version has to be bumped for an update to copy a new build.
- **Suggestions never load.** prompt-suggestions makes one extra model call per answered turn to generate them. Aborted, errored, refused and subagent turns are skipped by design.
- **The progress bar sits dimmed with "no update for N min".** The model has not reported progress for longer than `staleAfterMinutes`. It cannot report while a single blocking command runs; it reports again when control returns, or `/progress clear` removes the bar.

## Develop

- Validate a mod: `claude plugin validate <mod>/.claude-plugin/plugin.json`
- Test a mod: `claude plugin test <mod>`
- Type-check a mod once it has loaded: `npx -y -p typescript@latest tsc -p <mod>`
- Run a mod from its folder without installing: `claude --plugin-dir <mod>`, or symlink the folder into a session's `~/.claude/dev-mods/<session-id>/` folder with hot reloading enabled.
- Bump `version` in the mod's `plugin.json` with every change you want installed, then re-run `./install.sh` and `/reload-plugins`.

Each mod's README has the details of its behaviour, layout and settings.
