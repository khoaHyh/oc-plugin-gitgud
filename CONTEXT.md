# Context

## Domain

GitGud — an OpenCode TUI plugin that adds lightweight Git staging, commit message generation, commit, and push controls to the sidebar.

## Terms

- **GitGud** — the plugin; also the namespace for its UI surfaces and commands.
- **Git Status** — the live view of changed files in the worktree: staged, unstaged, untracked, and renamed.
- **Git change-set** — the collection of changed files with derived display facts (status label, color, additions/deletions, sort order).
- **Git action catalog** — the register of user-facing actions (stage, unstage, commit, push, generate message) with titles, categories, values, and enablement rules.
- **Commit message** — the subject and optional body produced by the commit-message generation flow.
- **Commit agent** — the OpenCode agent used when generating a commit message.
- **GitGud config** — the normalized runtime options loaded from the `package.json` export config and consumed by GitGud boot and actions.
- **Sidebar** — the OpenCode TUI sidebar slot where GitGud renders its summary and action buttons.
- **Git Status dialog** — the `DialogSelect` view that lists changed files and actions.

## Architecture notes

- The plugin exports `./tui` only; no server export.
- Config comes from `package.json` exports `config` block and is normalized at boot.
- Type-aware modules keep raw git porcelain codes inside Git change-set parsing; presentation modules consume derived display facts.

## Decisions

- (none recorded yet)
