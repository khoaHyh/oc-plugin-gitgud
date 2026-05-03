import { describe, expect, test } from "bun:test"
import type { GitFile } from "./change-set"
import type { GitState } from "./types"
import { createGitStatusDialogViewModel, createSidebarViewModel } from "./view-model"

const file = (patch: Partial<GitFile>): GitFile => ({
  path: "file.ts",
  previousPath: undefined,
  title: "file.ts",
  description: undefined,
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
  workflow: "git",
  graphite: { available: false, summary: undefined },
  message: "",
  files: [],
  unpushedCommits: 0,
  branch: undefined,
  error: undefined,
  ...patch,
})

describe("GitGud view model", () => {
  test("derives Sidebar summary and button enablement", () => {
    const view = createSidebarViewModel({
      state: state({
        files: [file({ path: "staged.ts", staged: true }), file({ path: "worktree.ts", unstaged: true })],
        unpushedCommits: 1,
      }),
    })

    expect(view.summary).toBe("1 unstaged · 1 staged")
    expect(view.hasFiles).toBe(true)
    expect(view.buttons.find((b) => b.label === "open")?.disabled).toBe(false)
    expect(view.buttons.find((b) => b.label === "stage")?.action).toBe("stage-all")
    expect(view.buttons.find((b) => b.label === "stage")?.disabled).toBe(false)
    expect(view.buttons.find((b) => b.label === "commit")?.disabled).toBe(false)
    expect(view.buttons.find((b) => b.label === "push")?.disabled).toBe(false)
  })

  test("uses one stage button that flips to unstage when all changes are staged", () => {
    const stagedOnly = createSidebarViewModel({ state: state({ files: [file({ staged: true })] }) })
    const unstagedOnly = createSidebarViewModel({ state: state({ files: [file({ unstaged: true })] }) })
    const noChanges = createSidebarViewModel({ state: state() })

    expect(stagedOnly.buttons.find((b) => b.label === "unstage")?.action).toBe("unstage-all")
    expect(stagedOnly.buttons.find((b) => b.label === "unstage")?.disabled).toBe(false)
    expect(unstagedOnly.buttons.find((b) => b.label === "stage")?.action).toBe("stage-all")
    expect(unstagedOnly.buttons.find((b) => b.label === "stage")?.disabled).toBe(false)
    expect(noChanges.buttons.find((b) => b.label === "stage")?.disabled).toBe(true)
  })

  test("derives Git Status dialog actions and file options", () => {
    const view = createGitStatusDialogViewModel({
      state: state({ files: [file({ path: "worktree.ts", unstaged: true })] }),
    })

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

  test("derives Graphite sidebar actions and stack summary", () => {
    const view = createSidebarViewModel({
      state: state({
        workflow: "graphite",
        graphite: { available: true, summary: "◉ feature/current" },
        files: [file({ staged: true })],
      }),
    })

    expect(view.stackSummary).toBe("◉ feature/current")
    expect(view.buttons.some((button) => button.label === "commit")).toBe(false)
    expect(view.buttons.some((button) => button.label === "push")).toBe(false)
    expect(view.buttons.find((button) => button.label === "create")?.action).toBe("graphite-create")
    expect(view.buttons.find((button) => button.label === "modify")?.disabled).toBe(false)
    expect(view.buttons.find((button) => button.label === "submit")?.action).toBe("graphite-submit-stack")
  })
})
