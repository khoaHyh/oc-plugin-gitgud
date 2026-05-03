import { describe, expect, test } from "bun:test"
import type { GitFile } from "./change-set"
import type { GitState } from "./types"
import { createGitStatusDialogViewModel, createSidebarViewModel } from "./view-model"

const file = (patch: Partial<GitFile>): GitFile => ({
  path: "file.ts",
  title: "file.ts",
  statusLabel: "·M",
  titleTone: "text",
  statusTone: "muted",
  staged: false,
  unstaged: false,
  untracked: false,
  tracked: true,
  additions: 0,
  deletions: 0,
  ...patch,
})

const state = (patch: Partial<GitState> = {}): GitState => ({
  loading: false,
  busy: false,
  message: "",
  files: [],
  unpushedCommits: 0,
  ...patch,
})

describe("GitGud view model", () => {
  test("derives Sidebar summary and button enablement", () => {
    const view = createSidebarViewModel(
      state({
        files: [file({ path: "staged.ts", staged: true }), file({ path: "worktree.ts", unstaged: true })],
        unpushedCommits: 1,
      }),
    )

    expect(view.summary).toBe("1 unstaged · 1 staged")
    expect(view.hasFiles).toBe(true)
    expect(view.buttons.find((b) => b.label === "open")?.disabled).toBe(false)
    expect(view.buttons.find((b) => b.label === "stage")?.action).toBe("stage-all")
    expect(view.buttons.find((b) => b.label === "stage")?.disabled).toBe(false)
    expect(view.buttons.find((b) => b.label === "commit")?.disabled).toBe(false)
    expect(view.buttons.find((b) => b.label === "push")?.disabled).toBe(false)
  })

  test("uses one stage button that flips to unstage when all changes are staged", () => {
    const stagedOnly = createSidebarViewModel(state({ files: [file({ staged: true })] }))
    const unstagedOnly = createSidebarViewModel(state({ files: [file({ unstaged: true })] }))
    const noChanges = createSidebarViewModel(state())

    expect(stagedOnly.buttons.find((b) => b.label === "unstage")?.action).toBe("unstage-all")
    expect(stagedOnly.buttons.find((b) => b.label === "unstage")?.disabled).toBe(false)
    expect(unstagedOnly.buttons.find((b) => b.label === "stage")?.action).toBe("stage-all")
    expect(unstagedOnly.buttons.find((b) => b.label === "stage")?.disabled).toBe(false)
    expect(noChanges.buttons.find((b) => b.label === "stage")?.disabled).toBe(true)
  })

  test("derives Git Status dialog actions and file options", () => {
    const view = createGitStatusDialogViewModel(state({ files: [file({ path: "worktree.ts", unstaged: true })] }))

    expect(view.title).toBe("Git Status")

    const actionValues: string[] = view.options.filter((o) => o.kind === "action").map((o) => o.value)
    expect(actionValues.includes("action:open-status")).toBe(false)
    expect(actionValues.includes("action:refresh")).toBe(false)
    expect(actionValues.includes("action:stage-all")).toBe(true)

    const firstFile = view.options.find((o) => o.kind === "file")
    expect(firstFile).toEqual({
      kind: "file",
      path: "worktree.ts",
      title: "file.ts",
      value: "file:worktree.ts",
      description: undefined,
      category: "Files",
      titleTone: "text",
      statusTone: "muted",
      statusLabel: "·M",
      additions: 0,
      deletions: 0,
    })
  })
})
