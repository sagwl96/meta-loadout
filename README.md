# meta-loadout

A Claude Code mod that manages your harness: every skill, rule, memory, MCP server, hook, plugin, permission and setting, with one switch each and profiles to swap whole setups. It works in the terminal and in a GUI pane for the Claude desktop app and the VS Code extension.

Based on [loadout](https://github.com/MK27MK/loadout) by Mattia Carella (MIT). meta-loadout adds:

- a desktop / VS Code GUI pane (`hooks/desktopView.tsx`)
- **All on / All off** per card (kind) and per plugin group
- **New profile** from scratch, with everything on or everything off

![The meta-loadout desktop pane](assets/desktop-pane.png)

*Illustration of the desktop pane (drawn from its layout, not a screenshot).*

## Install

```
/plugin marketplace add sagwl96/meta-loadout
/plugin install meta-loadout@meta-loadout
```

In the Claude desktop app: **+** next to the prompt box, then Plugins, Add marketplace `sagwl96/meta-loadout`, then Add plugin.

To run it from a local clone instead:

```
claude --plugin-dir path/to/meta-loadout
```

## The pane

![The terminal pane next to a Claude Code session](assets/showcase.png)

*The terminal pane, from the original loadout.*

`/meta-loadout` opens the pane. Elements are grouped by kind, and each row is one harness element:

```
☑ ecc:plan              plugin   plugin ecc (user)
☐ rules/testing.md      user     ~/.claude/rules/ecc/testing.md
☑ hooks.Stop            policy   locked · managed settings
```

- Press the checkbox to turn an element on or off.
- `Project` picks the project whose files are listed, `Scope` filters by scope.
- The tabs at the bottom are the profiles, with the applied one in brackets. Press a tab to look at a profile. Its `▸` menu applies, duplicates, renames or deletes it.
- `+` duplicates the profile you are looking at under a new name.
- `Refresh` reads the harness again.

Keys: Tab moves between controls, Enter presses, Esc returns to the prompt.

## Desktop app

In the Claude desktop app and the VS Code extension the pane is a GUI instead of the terminal text view: dropdowns for profile, project and scope, an On/Off button per element, one card per kind (click its header to open it), scope chips, clickable file origins, and Prev/Next paging. Each card and each plugin group has **All on** and **All off**, and **New profile** creates a profile from scratch with everything on or off. The terminal keeps the text view.

## What it manages

| Kind | Off means | Writes a file |
|---|---|---|
| CLAUDE.md, rules, memories | The file is left out of the context | No |
| Skills and commands | The command is hidden and refuses to run | No |
| Agents | The agent is not offered to the model | No |
| MCP servers | Every call to the server is denied | No |
| Hook events | All hooks of that event are skipped | No |
| Hooks in settings | The hook is removed from its `settings.json` | Yes |
| Plugins | `enabledPlugins` is set to `false` | Yes |
| Permissions | The rule is removed from its `settings.json` | Yes |
| Settings | The key is removed from its `settings.json` | Yes |

Plugin hooks can only be skipped per event, not one by one. After a plugin toggle, run `/reload-plugins`.

## Scopes

Every row shows where the element comes from:

| Scope | Source |
|---|---|
| `policy` | Managed settings of your organization. Always locked. |
| `flag` | Command-line flags. Always locked. |
| `user` | Your config directory (`~/.claude`, or `CLAUDE_CONFIG_DIR`) |
| `project` | `.claude/` and `.mcp.json` in the project |
| `local` | `.claude/settings.local.json` |
| `plugin` | An installed plugin, with the scope it was installed in |
| `account` | A claude.ai connector |
| `memory` | A memory file |
| `mixed` | A hook event with hooks from more than one scope |

## Profiles

A profile starts with everything on or everything off, and remembers the elements you toggled.

- `default`: your harness as it is.
- `vanilla`: everything off, except permissions and settings. It is built in and cannot be changed, renamed or deleted. Duplicate it to build on it.

To compose a setup from several harnesses, create a profile that starts with everything off and switch on the pieces you want (in the desktop GUI: **New profile**, then **All on** per card or plugin group):

```
/meta-loadout new ecc-react off
```

## Commands

| Command | Does |
|---|---|
| `/meta-loadout` | Opens the pane |
| `/meta-loadout status` | Lists what is off in the active profile |
| `/meta-loadout list` | Lists the profiles |
| `/meta-loadout use <profile>` | Switches profile |
| `/meta-loadout new <profile> [on\|off]` | Creates a profile with everything on or everything off. Without either, copies the active one. |
| `/meta-loadout rename <profile> <new name>` | Renames a profile |
| `/meta-loadout delete <profile>` | Deletes a profile |
| `/meta-loadout project [<folder>]` | Lists the files of another project folder. Without a folder, goes back to the session's project. |

Only you can change profiles. A `/meta-loadout use` that you did not type is refused.

## Safety

- Before the first change to a settings file, meta-loadout copies it to `<config dir>/meta-loadout-backups/`.
- A removed entry is stored and restored only into the file it came from.
- Setting values are never shown, only their keys.
- Project settings behind a symbolic link are not written.

## Development

```
claude plugin validate .
claude plugin test .
```

The engine does not allow `$` to cross an import, so every engine call is in `hooks/register.tsx`. The other files in `hooks/` are pure functions.

## License

[MIT](LICENSE). Original work (c) 2026 Mattia Carella; additions (c) 2026 sagwl96.
