import { describe, expect, test } from "bun:test"
import { gitActionCatalog, gitDialogActionOptions, parseGitDialogActionValue } from "./action-catalog"
import type { GitFile } from "./change-set"
import type { GitState } from "./types"

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

describe("Git action catalog", () => {
  test("shows only status-dialog actions and parses only selectable action values", () => {
    const optionValues: string[] = gitDialogActionOptions(state({ files: [file({ staged: true })] })).map(
      (item) => item.value,
    )

    expect(optionValues.includes("action:stage-all")).toBe(true)
    expect(optionValues.includes("action:commit")).toBe(true)
    expect(optionValues.includes("action:open-status")).toBe(false)
    expect(optionValues.includes("action:refresh")).toBe(false)
    expect(parseGitDialogActionValue("action:push")).toBe("push")
    expect(parseGitDialogActionValue("action:refresh")).toBeUndefined()
    expect(parseGitDialogActionValue("file:README.md")).toBeUndefined()
  })

  test("enables actions from changed-file state", () => {
    const unstagedOnly = gitDialogActionOptions(state({ files: [file({ unstaged: true })] }))
    const stagedOnly = gitDialogActionOptions(state({ files: [file({ staged: true })] }))
    const untrackedOnly = gitDialogActionOptions(state({ files: [file({ untracked: true, tracked: false })] }))
    const busy = gitDialogActionOptions(state({ busy: true, files: [file({ staged: true, unstaged: true })] }))

    expect(unstagedOnly.find((item) => item.value === "action:stage-all")?.disabled).toBe(false)
    expect(unstagedOnly.find((item) => item.value === "action:unstage-all")?.disabled).toBe(true)
    expect(unstagedOnly.find((item) => item.value === "action:commit")?.disabled).toBe(true)
    expect(stagedOnly.find((item) => item.value === "action:stage-all")?.disabled).toBe(true)
    expect(stagedOnly.find((item) => item.value === "action:unstage-all")?.disabled).toBe(false)
    expect(stagedOnly.find((item) => item.value === "action:commit")?.disabled).toBe(false)
    expect(stagedOnly.find((item) => item.value === "action:push")?.disabled).toBe(true)
    expect(
      gitDialogActionOptions(state({ files: [file({ staged: true })], unpushedCommits: 1 })).find(
        (item) => item.value === "action:push",
      )?.disabled,
    ).toBe(false)
    expect(untrackedOnly.find((item) => item.value === "action:stage-all")?.disabled).toBe(false)
    expect(busy.every((item) => item.disabled)).toBe(true)
  })
})
