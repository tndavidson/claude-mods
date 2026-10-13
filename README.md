# claude-mods

Mods for Claude Code, one per folder. Each folder is a plugin of function hooks that changes the Claude Code interface; this root is the marketplace that installs them.

| Mod | What it does |
| --- | --- |
| [prompt-suggestions-mod](prompt-suggestions-mod/) | Suggests three next-step prompts as buttons above the prompt box after each turn. |
| [task-progress-mod](task-progress-mod/) | Shows a progress bar and estimated minutes remaining above the prompt box while a long task runs. |

Both draw in the band above the prompt and share it: each stacks itself above whatever the other drew.

## Install

Install every mod at user scope, so it loads in all Claude Code sessions on this machine:

```bash
./install.sh
```

The script registers this folder as the `claude-mods` marketplace (or refreshes it if already registered), installs each plugin the marketplace lists, and updates any that were already installed. `--scope project` or `--scope local` narrows where they load.

Installing copies a mod into Claude Code's plugin cache; sessions load that copy, not this folder. Re-run the script after every change you want other sessions to see, then run `/reload-plugins` in sessions already open. Bump the `version` in the mod's `plugin.json` with every change you want installed: the update step compares versions and leaves a mod alone when its version has not moved, and the cache is keyed by version, so the bump is what makes the new copy load.

Once the repository is on GitHub, a single mod installs from inside a terminal session of Claude Code with:

```
/plugin install prompt-suggestions --marketplace <owner>/<repo>
```

## Develop

- Validate a mod: `claude plugin validate <mod>/.claude-plugin/plugin.json`
- Test a mod: `claude plugin test <mod>`
- Type-check a mod once it has loaded: `npx -y -p typescript@latest tsc -p <mod>`
- Run a mod from its folder without installing: `claude --plugin-dir <mod>`, or symlink the folder into a session's `~/.claude/dev-mods/<session-id>/` folder with hot reloading enabled.

Each mod's README has the details of its behaviour and settings.
