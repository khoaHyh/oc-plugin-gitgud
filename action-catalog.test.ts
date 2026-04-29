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
  ...patch,
})

describe("Git action catalog", () => {
  test("keeps command values and dialog actions in one catalog", () => {
    expect(gitActionCatalog.map((item) => item.value)).toEqual([
      "open-status",
      "stage-all",
      "unstage-all",
      "generate-commit-message",
      "commit",
      "push",
      "refresh",
    ])
    expect(gitDialogActionOptions(state({ files: [file({ staged: true })] })).map((item) => item.value)).toEqual([
      "action:stage-all",
      "action:unstage-all",
      "action:generate-commit-message",
      "action:commit",
      "action:push",
    ])
  })

  test("centralizes enablement rules", () => {
    const options = gitDialogActionOptions(state({ files: [file({ unstaged: true })] }))

    expect(options.find((item) => item.value === "action:stage-all")?.disabled).toBe(false)
    expect(options.find((item) => item.value === "action:unstage-all")?.disabled).toBe(true)
    expect(parseGitDialogActionValue("action:push")).toBe("push")
    expect(parseGitDialogActionValue("action:refresh")).toBeUndefined()
  })
})
