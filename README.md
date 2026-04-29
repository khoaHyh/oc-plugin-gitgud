# GitGud plugin for OpenCode

Lightweight Git controls for the OpenCode TUI sidebar: review your working tree,
stage and unstage files, generate commit messages with an LLM, commit, and push without leaving
OpenCode.

Inspired by [lazygit](https://github.com/jesseduffield/lazygit).

## Installation

Install from the CLI:

```bash
opencode plugin oc-plugin-gitgud
```

Or from OpenCode commands:

1. Press `Ctrl+P`
2. Select `Install Plugin`
3. Enter `oc-plugin-gitgud`

## Options

Plugin options can be configured via the `tui.json` config file.

### TUI

- `enabled` (`boolean`, default `true`)
- `replace_sidebar_files` (`boolean`, default `false`) disables OpenCode's default Modified Files sidebar card
- `confirm_push` (`boolean`, default `true`)
- `confirm_stage_all_on_commit` (`boolean`, default `true`)
- `commit_agent` (`string`, default `"build"`)

## Commands

- `GitGud: Stage all`
- `GitGud: Unstage all`
- `GitGud: Open Git Status`
- `GitGud: Generate commit message`
- `GitGud: Commit`
- `GitGud: Push`
- `GitGud: Refresh`

