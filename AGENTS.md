# Agent Notes

## Commands

- Use Bun for local checks: `bun test`, `bun run typecheck`, `bun run fmt:check`; format with `bun run fmt`.
- Run a focused test file with `bun test runtime.test.ts`; Bun also supports name filtering, e.g. `bun test runtime.test.ts -t "push warns"`.
- There are no repo CI workflows. Before handing off code changes, at minimum run the relevant `bun test ...` plus `bun run typecheck`; run `bun run fmt:check` when formatting may have changed.

## Architecture

- This package exports only `./tui` from `tui.tsx`; do not add server-side plugin surfaces unless the package export changes too.
- `tui.tsx` should stay the OpenCode/OpenTUI assembly seam: host adapter wiring, Solid UI, commands, slots, keybinds, lifecycle, and watcher refresh.
- `runtime.ts` owns GitGud state transitions, action execution policy, commit-message flow, and mutation refresh behavior. Tests should exercise this through in-memory `GitGudHostAdapter` and `GitProcessAdapter` fakes.
- `git.ts` is the real Git process adapter. It uses `Bun.spawn`, chooses `api.state.path.worktree || api.state.path.directory || process.cwd()`, and sets `GIT_TERMINAL_PROMPT=0`.
- Keep raw `git status --porcelain -z` parsing inside `change-set.ts`; UI and dialogs should consume `GitFile` and view-model facts instead of reinterpreting porcelain codes.
- Keep command/dialog/sidebar enablement in the declarative action catalog and view models (`action-catalog.ts`, `view-model.ts`), not duplicated in TSX components.

## Style Guide

- Embrace `const` assertions for type safety and immutability
- Strive for data immutability using types like Readonly and ReadonlyArray
- Organize code by feature and collocate related code as close as possible.
- Avoid type assertions in favor of proper type definitions
- Avoid try/catch where possible
- Avoid using the `any` type

Prefer single object function arguments instead of multiple arguments.

```typescript
// ❌ Avoid having multiple arguments
doSumCrazy("client", false, 60)

// ✅ Use options object as argument
doSumCrazy({
  method: "client",
  isValidated: false,
  minLines: 60,
})
```

Embrace discriminated unions. Make the majority of object properties required (use optional properties sparingly)

```typescript
// ❌ Avoid optional properties when possible, as they increase complexity and ambiguity
type User = {
  id?: number
  email?: string
  dashboardAccess?: boolean
  adminPermissions?: ReadonlyArray<string>
  subscriptionPlan?: "free" | "pro" | "premium"
  rewardsPoints?: number
  temporaryToken?: string
}

// ✅ Prefer required properties. If optional properties are unavoidable,
// use a discriminated union to make object usage explicit and predictable.
type AdminUser = {
  role: "admin"
  id: number
  email: string
  dashboardAccess: boolean
  adminPermissions: ReadonlyArray<string>
}

type RegularUser = {
  role: "regular"
  id: number
  email: string
  subscriptionPlan: "free" | "pro" | "premium"
  rewardsPoints: number
}

type GuestUser = {
  role: "guest"
  temporaryToken: string
}

// Discriminated union type 'User' ensures clear intent with no optional properties
type User = AdminUser | RegularUser | GuestUser

const regularUser: User = {
  role: "regular",
  id: 212,
  email: "lea@user.com",
  subscriptionPlan: "pro",
  rewardsPoints: 1500,
  dashboardAccess: false, // Error: 'dashboardAccess' property does not exist
}
```

## Config and packaging gotchas

- User-facing defaults live in the `package.json` `exports["./tui"].config` block and are normalized in `config.ts`; keep `README.md` options and tests in sync when changing them.
- Root dependencies are intentionally peer deps for OpenCode/OpenTUI/Solid. `.opencode/tui.json` is the local harness that loads this plugin via `"../"`; `.opencode/` is npmignored local config.
- Published files are restricted by `package.json` `files`; add new runtime source files there or they will not ship.

## Testing

- Avoid mocks as much as possible
- Testing the interface, not the implementation to ensure that tests remain stable even when internal code changes
- When testing actual implementation, do not duplicate logic into tests and instead test the actual implementation
