import { describe, expect, test } from "bun:test"
import type { GitFile } from "./change-set"
import { defaultConfig, type GitGudConfig } from "./config"
import { createGitGudRuntime, type GitGudHostAdapter, type GitProcessAdapter } from "./runtime"
import type { GitState, ToastVariant } from "./types"

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

const result = (stdout = "") => ({ code: 0, stdout, stderr: "" })

type HarnessInput = Readonly<{
  patch: Partial<GitState>
  config: GitGudConfig
}>

const createHarness = (input: Partial<HarnessInput> = {}) => {
  const patch = input.patch ?? {}
  const config = input.config ?? defaultConfig
  let state: GitState = {
    loading: false,
    busy: false,
    message: "",
    files: [],
    unpushedCommits: 0,
    branch: "main",
    error: undefined,
    ...patch,
  }
  const operations: string[] = []
  const toasts: [ToastVariant, string][] = []
  const confirmations: { title: string; message: string }[] = []
  let confirm: (() => void) | undefined
  let commitPrompt = ""
  let commitPromptBusy: boolean | undefined
  let commitPromptConfirm: ((value: string) => void) | undefined
  let commitMessageRequest: Parameters<GitGudHostAdapter["requestCommitMessage"]>[0] | undefined

  const git: GitProcessAdapter = {
    async status() {
      operations.push("status")
      return state.files
    },
    async stageFile(item) {
      operations.push(`stage:${item.path}`)
      return result()
    },
    async stageAll() {
      operations.push("stage-all")
      return result()
    },
    async unstageFile(item) {
      operations.push(`unstage:${item.path}`)
      return result()
    },
    async unstageAll() {
      operations.push("unstage-all")
      return result()
    },
    async stagedDiff() {
      operations.push("staged-diff")
      return result("diff --git a/file.ts b/file.ts")
    },
    async stagedStat() {
      operations.push("staged-stat")
      return result(" file.ts | 1 +")
    },
    async unpushedCommits() {
      operations.push("unpushed-commits")
      return state.unpushedCommits
    },
    async commit({ message }) {
      operations.push(`commit:${message}`)
      return result()
    },
    async push() {
      operations.push("push")
      return result()
    },
  }

  const host: GitGudHostAdapter = {
    branch: () => state.branch,
    toast: ({ variant, message }) => toasts.push([variant, message]),
    confirm(input) {
      confirmations.push({ title: input.title, message: input.message })
      confirm = input.onConfirm
    },
    promptCommit(input) {
      commitPrompt = input.initial
      commitPromptBusy = input.busy
      commitPromptConfirm = input.onConfirm
    },
    showStatus() {
      operations.push("show-status")
    },
    clearDialog() {
      operations.push("clear-dialog")
    },
    async requestCommitMessage(input) {
      commitMessageRequest = input
      operations.push(`commit-agent:${input.agent}:${input.prompt.includes("DIFF:")}`)
      return [{ type: "text", text: "feat: test runtime" }]
    },
  }

  const runtime = createGitGudRuntime({
    git,
    host,
    config,
    state: () => state,
    setState: (patch) => {
      state = { ...state, ...patch }
    },
  })

  return {
    runtime,
    get state() {
      return state
    },
    operations,
    toasts,
    confirmations,
    confirm: () => confirm?.(),
    confirmCommit: ({ message }: { message: string }) => commitPromptConfirm?.(message),
    get commitPrompt() {
      return commitPrompt
    },
    get commitPromptBusy() {
      return commitPromptBusy
    },
    get commitMessageRequest() {
      return commitMessageRequest
    },
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("GitGud runtime", () => {
  test("stages an unstaged file and unstages a staged file when selected", async () => {
    const staged = file({ path: "staged.ts", staged: true })
    const unstaged = file({ path: "unstaged.ts", unstaged: true })
    const harness = createHarness({ patch: { files: [staged, unstaged] } })

    harness.runtime.selectStatusFile("unstaged.ts")
    await tick()
    harness.runtime.selectStatusFile("staged.ts")
    await tick()

    const mutations = harness.operations.filter((op) => op.startsWith("stage:") || op.startsWith("unstage:"))
    expect(mutations).toEqual(["stage:unstaged.ts", "unstage:staged.ts"])
  })

  test("confirms stage-all before commit when no files are staged", async () => {
    const harness = createHarness({ patch: { files: [file({ unstaged: true })] } })

    harness.runtime.showCommit()
    expect(harness.confirmations.length).toBe(1)
    expect(harness.confirmations[0]?.title).toBe("Stage all changes?")

    harness.confirm()
    await tick()

    expect(harness.operations).toContain("stage-all")
    expect(harness.toasts).toEqual([["success", "Staged all changes."]])
  })

  test("commit action generates a commit message for staged changes", async () => {
    const harness = createHarness({ patch: { files: [file({ staged: true })] } })

    harness.runtime.runAction("commit")
    await tick()

    expect(harness.operations).toContain("staged-stat")
    expect(harness.operations).toContain("staged-diff")
    expect(harness.operations).toContain("commit-agent:build:true")
    expect(harness.commitPrompt).toBe("feat: test runtime")
  })

  test("commit prompt confirmation commits through the git adapter", async () => {
    const harness = createHarness({ patch: { files: [file({ staged: true })], message: "fix: refresh" } })

    harness.runtime.showCommit()
    harness.confirmCommit({ message: "fix: refresh" })
    await tick()

    expect(harness.operations).toContain("commit:fix: refresh")
    expect(harness.operations).toContain("clear-dialog")
    expect(harness.state.message).toBe("")
    expect(harness.toasts).toEqual([["success", "Committed staged changes."]])
  })

  test("push warns when there are no unpushed commits", async () => {
    const harness = createHarness({ patch: { unpushedCommits: 0 } })

    await harness.runtime.push()

    expect(harness.operations.includes("push")).toBe(false)
    expect(harness.toasts).toEqual([["warning", "No unpushed commits to push."]])
  })

  test("generates a Commit message through the host adapter", async () => {
    const harness = createHarness({ patch: { files: [file({ staged: true })] } })

    await harness.runtime.generateMessage()

    expect(harness.operations).toContain("staged-stat")
    expect(harness.operations).toContain("staged-diff")
    expect(harness.operations).toContain("commit-agent:build:true")
    expect(harness.state.message).toBe("feat: test runtime")
    expect(harness.commitPrompt).toBe("feat: test runtime")
    expect(harness.commitPromptBusy).toBe(false)
  })

  test("generates a commit message with configured model and user instructions", async () => {
    const harness = createHarness({
      patch: { files: [file({ staged: true })] },
      config: {
        ...defaultConfig,
        commitModel: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
        commitSystemInstructions: "Mention the ticket ID when one is present.",
      },
    })

    await harness.runtime.generateMessage()

    expect(harness.commitMessageRequest?.model).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-20250514",
    })
    expect(harness.commitMessageRequest?.system).toContain("Return only the commit message")
    expect(harness.commitMessageRequest?.system).toContain("Mention the ticket ID when one is present.")
  })
})
