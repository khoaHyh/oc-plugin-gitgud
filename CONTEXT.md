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
- **GitGud runtime** — the deepened module that owns GitGud state transitions, Git Status refresh, Git mutations, Commit message workflow, and action execution behind the TUI assembly seam.
- **GitGud host adapter** — the adapter from the OpenCode TUI plugin API into runtime requests for dialogs, toasts, command registration, lifecycle, keybinds, and Commit agent sessions.
- **Git process adapter** — the adapter that executes git commands in the current worktree for Git Status, staging, committing, and pushing.
- **GitGud view model** — derived display and selection facts produced for Sidebar and Git Status dialog rendering, including Git action catalog enablement.
- **Sidebar** — the OpenCode TUI sidebar slot where GitGud renders its summary and action buttons.
- **Git Status dialog** — the `DialogSelect` view that lists changed files and actions.

## Architecture notes

- The plugin exports `./tui` only; no server export.
- Config comes from `package.json` exports `config` block and is normalized at boot.
- Type-aware modules keep raw git porcelain codes inside Git change-set parsing; presentation modules consume derived display facts.

## Decisions

- GitGud runtime is the primary deepened module; `tui.tsx` should remain the OpenCode-style TUI assembly seam.
- GitGud should follow OpenCode plugin structure, naming, and UI patterns.
- Runtime tests should use in-memory GitGud host and Git process adapters so the runtime seam is real, not hypothetical.
- Sidebar and Git Status dialog should render GitGud view model facts instead of recomputing raw Git State policy locally.
- Git action catalog data stays declarative; GitGud runtime owns action execution policy, including Git Status file selection behaviour.
- GitGud host adapter owns OpenCode lifecycle wiring such as watcher registration, debounced refresh scheduling, command registration, slot registration, and cleanup.
