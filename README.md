# GitGud plugin for OpenCode

Lightweight Git and Graphite controls for the OpenCode TUI sidebar: review your working tree,
stage and unstage files, generate commit messages with an LLM, commit, and submit/push without leaving
OpenCode.

Inspired by [lazygit](https://github.com/jesseduffield/lazygit).

## Demo

### Basic git actions (stage, commit, push)

![Git workflow demo 1](assets/gitgud-demo.mov)

### Staging, modifying, and submitting graphite stack

![Graphite workflow demo 1](assets/graphite-gitgud-1.mp4)

### Moving up and down the graphite stack

![Graphite workflow demo 2](assets/graphite-gitgud-2.mp4)

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
- `workflow` (`"auto" | "git" | "graphite"`, default `"auto"`) chooses the GitGud workflow.
  `auto` uses Graphite controls when the `gt` CLI can read the current stack; otherwise it keeps
  the standard Git controls.
- `replace_sidebar_files` (`boolean`, default `false`) disables OpenCode's default Modified Files sidebar card
- `confirm_push` (`boolean`, default `true`)
- `confirm_stage_all_on_commit` (`boolean`, default `true`)
- `commit_agent` (`string`, optional) overrides the agent used for generated commit messages. When unset,
  OpenCode uses its normal default for the generated session.
- `commit_model` (`string`, optional) overrides the model for generated commit messages using
  `provider/model` format, for example `opencode-go/kimi-k2.6`
- `commit_system_instructions` (`string`, optional) appends extra style guidance to GitGud's default
  commit-message system prompt
- `keybinds` (`object`) overrides GitGud's OpenCode command keybinds. Set a keybind to `false`,
  `null`, an empty string, or `"none"` to disable it.

For example:

```json
{
  "commit_model": "opencode-go/kimi-k2.6",
  "commit_system_instructions": "Prefer short conventional commits. Mention issue IDs when present."
}
```

Default keybinds use OpenCode leader sequences to avoid common terminal, macOS, and window-manager
shortcuts. Mutating actions use uppercase shifted leader chords to reduce accidental collisions with
OpenCode's lowercase leader defaults:

```json
{
  "keybinds": {
    "open_status": "<leader>v",
    "stage_all": "<leader>A",
    "unstage_all": "<leader>U",
    "generate_commit_message": "<leader>p",
    "commit": "<leader>C",
    "push": "<leader>P",
    "graphite_create": "none",
    "graphite_modify": "none",
    "graphite_submit_stack": "none",
    "graphite_sync": "none",
    "graphite_up": "none",
    "graphite_down": "none",
    "refresh": "f5"
  }
}
```

### Graphite workflow

When `workflow` is `"graphite"`, or `"auto"` detects a usable [Graphite](https://graphite.com/)
CLI stack, GitGud keeps the same simple working-tree controls but swaps commit/push for stacked-diff
actions using Graphite's canonical commands:

- Create Graphite branch: prompts for a branch name, then runs `gt create <branch> --no-interactive`
  without staging or committing changes. If files are staged, GitGud asks you to unstage them first
  to avoid Graphite committing staged changes.
- Modify current diff: generates an editable commit message for staged changes, then runs
  `gt modify --commit --message "message"` (`gt m -cm "message"`)
- Submit stack: `gt submit --stack` (`gt ss`)
- Sync stack: `gt sync`
- Move up/down stack: `gt up` / `gt down`

## Commands

- `GitGud: Stage all`
- `GitGud: Unstage all`
- `GitGud: Open Git Status`
- `GitGud: Generate commit message`
- `GitGud: Commit`
- `GitGud: Push`
- `GitGud: Create Graphite branch`
- `GitGud: Modify current diff`
- `GitGud: Submit stack`
- `GitGud: Sync stack`
- `GitGud: Move up stack`
- `GitGud: Move down stack`
- `GitGud: Refresh`
