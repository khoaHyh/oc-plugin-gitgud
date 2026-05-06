import { describe, expect, test } from "bun:test"
import type { GitFile } from "./change-set"
import { defaultConfig, type GitGudConfig } from "./config"
import type { GitResult } from "./git"
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
  graphiteLog: GitResult
  graphiteLogShort: () => Promise<GitResult>
  status: () => Promise<ReadonlyArray<GitFile>>
}>

const createHarness = (input: Partial<HarnessInput> = {}) => {
  const patch = input.patch ?? {}
  const config = input.config ?? defaultConfig
  const graphiteLog =
    input.graphiteLog ??
    (config.workflow === "graphite" ? result("◉ main\n") : { code: 1, stdout: "", stderr: "not tracked" })
  const graphiteLogShort = input.graphiteLogShort ?? (() => Promise.resolve(graphiteLog))
  let state: GitState = {
    loading: false,
    busy: false,
    workflow: config.workflow === "graphite" ? "graphite" : "git",
    graphite: { available: config.workflow === "graphite", summary: undefined },
    message: "",
    files: [],
    unpushedCommits: 0,
    branch: "main",
    error: undefined,
    ...patch,
  }
  const status = input.status ?? (() => Promise.resolve(state.files))
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
      return status()
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
    async changedDiff() {
      operations.push("changed-diff")
      if (state.files.every((item) => item.untracked && !item.staged && !item.unstaged)) return result("")
      return result("diff --git a/file.ts b/file.ts")
    },
    async changedStat() {
      operations.push("changed-stat")
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
    async graphiteLogShort() {
      operations.push("gt-log-short")
      return graphiteLogShort()
    },
    async graphiteCreate({ branch }) {
      operations.push(`gt-create:${branch}`)
      return result()
    },
    async graphiteModify({ message }) {
      operations.push(`gt-modify:${message}`)
      return result()
    },
    async graphiteModifyAll({ message }) {
      operations.push(`gt-modify-all:${message}`)
      return result()
    },
    async graphiteSubmitStack() {
      operations.push("gt-submit-stack")
      return result()
    },
    async graphiteSync() {
      operations.push("gt-sync")
      return result()
    },
    async graphiteUp() {
      operations.push("gt-up")
      return result()
    },
    async graphiteDown() {
      operations.push("gt-down")
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
    promptText(input) {
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
      operations.push(`commit-agent:${input.agent ?? "default"}:${input.prompt.includes("DIFF:")}`)
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

  test("showCommit confirms all changed files without staging before the message is accepted", async () => {
    const harness = createHarness({ patch: { files: [file({ unstaged: true })] } })

    harness.runtime.showCommit()
    expect(harness.confirmations.length).toBe(1)
    expect(harness.confirmations[0]?.title).toBe("Commit all changes?")

    harness.confirm()
    await tick()

    expect(harness.operations.includes("stage-all")).toBe(false)
    expect(harness.commitPromptBusy).toBe(false)
  })

  test("commit stages all changed files only after confirming the generated message", async () => {
    const harness = createHarness({ patch: { files: [file({ unstaged: true })] } })

    harness.runtime.runAction("commit")
    expect(harness.confirmations.length).toBe(1)
    expect(harness.operations.includes("stage-all")).toBe(false)

    harness.confirm()
    await tick()

    expect(harness.operations).toContain("changed-stat")
    expect(harness.operations).toContain("changed-diff")
    expect(harness.commitPrompt).toBe("feat: test runtime")
    expect(harness.operations.includes("stage-all")).toBe(false)

    harness.confirmCommit({ message: "feat: test runtime" })
    await tick()

    expect(harness.operations).toContain("stage-all")
    expect(harness.operations).toContain("commit:feat: test runtime")
    expect(harness.operations.indexOf("stage-all") < harness.operations.indexOf("commit:feat: test runtime")).toBe(true)
  })

  test("commit includes untracked file names in all-changes message context", async () => {
    const harness = createHarness({ patch: { files: [file({ path: "new.ts", untracked: true, tracked: false })] } })

    harness.runtime.runAction("commit")
    harness.confirm()
    await tick()

    expect(harness.commitMessageRequest?.prompt).toContain("UNTRACKED FILES:")
    expect(harness.commitMessageRequest?.prompt).toContain("new.ts")
  })

  test("commit all-changes workflow skips the confirmation when configured", async () => {
    const harness = createHarness({
      patch: { files: [file({ unstaged: true })] },
      config: { ...defaultConfig, confirmStageAllOnCommit: false },
    })

    harness.runtime.runAction("commit")
    await tick()

    expect(harness.confirmations.length).toBe(0)
    expect(harness.operations).toContain("changed-stat")
    expect(harness.commitPrompt).toBe("feat: test runtime")
  })

  test("commit action generates a commit message for staged changes", async () => {
    const harness = createHarness({ patch: { files: [file({ staged: true })] } })

    harness.runtime.runAction("commit")
    await tick()

    expect(harness.operations).toContain("staged-stat")
    expect(harness.operations).toContain("staged-diff")
    expect(harness.operations).toContain("commit-agent:default:true")
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

  test("auto workflow falls back to Git when Graphite is unavailable", async () => {
    const harness = createHarness({
      patch: { files: [file({ staged: true })] },
      graphiteLog: { code: 1, stdout: "", stderr: "gt not found" },
    })

    await harness.runtime.refresh()

    expect(harness.operations).toContain("gt-log-short")
    expect(harness.state.workflow).toBe("git")
    expect(harness.state.graphite.available).toBe(false)
  })

  test("auto workflow uses Graphite when stack information is available", async () => {
    const harness = createHarness({ graphiteLog: result("◉ feature/current\n") })

    await harness.runtime.refresh()

    expect(harness.state.workflow).toBe("graphite")
    expect(harness.state.graphite).toEqual({ available: true, summary: "◉ feature/current" })
  })

  test("file refresh reuses cached Graphite state without probing Graphite", async () => {
    const harness = createHarness({ graphiteLog: result("◉ feature/current\n") })

    await harness.runtime.refresh()
    await harness.runtime.refresh({ probeGraphite: false })

    expect(harness.operations.filter((op) => op === "gt-log-short").length).toBe(1)
    expect(harness.state.workflow).toBe("graphite")
    expect(harness.state.graphite).toEqual({ available: true, summary: "◉ feature/current" })
  })

  test("file refreshes coalesce behind an active Graphite probe", async () => {
    let releaseGraphite: (() => void) | undefined
    const graphiteReleased = new Promise<void>((resolve) => {
      releaseGraphite = resolve
    })
    const harness = createHarness({
      graphiteLogShort: async () => {
        await graphiteReleased
        return result("◉ feature/current\n")
      },
    })

    const initialRefresh = harness.runtime.refresh()
    await tick()
    const fileRefresh = harness.runtime.refresh({ probeGraphite: false })
    if (!releaseGraphite) throw new Error("Expected Graphite probe to be pending")
    releaseGraphite()
    await Promise.all([initialRefresh, fileRefresh])

    expect(harness.operations.filter((op) => op === "gt-log-short").length).toBe(1)
    expect(harness.operations.filter((op) => op === "status").length).toBe(2)
    expect(harness.state.workflow).toBe("graphite")
  })

  test("queued refresh upgrades probeGraphite when a branch refresh follows a file refresh", async () => {
    let releaseStatus: (() => void) | undefined
    const statusReleased = new Promise<void>((resolve) => {
      releaseStatus = resolve
    })
    const harness = createHarness({
      graphiteLog: result("◉ feature/current\n"),
      status: async () => {
        await statusReleased
        return []
      },
    })

    const fileRefresh = harness.runtime.refresh({ probeGraphite: false })
    await tick()
    const branchRefresh = harness.runtime.refresh({ probeGraphite: true })
    if (!releaseStatus) throw new Error("Expected status refresh to be pending")
    releaseStatus()
    await Promise.all([fileRefresh, branchRefresh])

    expect(harness.operations.filter((op) => op === "status").length).toBe(2)
    expect(harness.operations.filter((op) => op === "gt-log-short").length).toBe(1)
    expect(harness.state.workflow).toBe("graphite")
  })

  test("Git mutations reuse cached Graphite state without probing Graphite", async () => {
    const harness = createHarness({ graphiteLog: result("◉ feature/current\n") })

    await harness.runtime.refresh()
    await harness.runtime.stageAll()

    expect(harness.operations).toContain("stage-all")
    expect(harness.operations.filter((op) => op === "gt-log-short").length).toBe(1)
    expect(harness.state.workflow).toBe("graphite")
  })

  test("generates a Commit message through the host adapter", async () => {
    const harness = createHarness({ patch: { files: [file({ staged: true })] } })

    await harness.runtime.generateMessage()

    expect(harness.operations).toContain("staged-stat")
    expect(harness.operations).toContain("staged-diff")
    expect(harness.operations).toContain("commit-agent:default:true")
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

  test("Graphite create prompts for a branch and creates a branch-only stack", async () => {
    const harness = createHarness({
      patch: { files: [file({ unstaged: true })] },
      config: { ...defaultConfig, workflow: "graphite" },
    })

    harness.runtime.runAction("graphite-create")
    harness.confirmCommit({ message: "feature/stacked-diff" })
    await tick()

    expect(harness.operations.includes("changed-stat")).toBe(false)
    expect(harness.operations.includes("changed-diff")).toBe(false)
    expect(harness.operations).toContain("gt-create:feature/stacked-diff")
    expect(harness.operations).toContain("clear-dialog")
  })

  test("Graphite create does not commit untracked-only changes", async () => {
    const harness = createHarness({
      patch: { files: [file({ untracked: true, tracked: false })] },
      config: { ...defaultConfig, workflow: "graphite" },
    })

    harness.runtime.runAction("graphite-create")
    harness.confirmCommit({ message: "feature/add-file" })
    await tick()

    expect(harness.operations.includes("changed-stat")).toBe(false)
    expect(harness.operations.includes("changed-diff")).toBe(false)
    expect(harness.operations).toContain("gt-create:feature/add-file")
  })

  test("Graphite create refuses staged changes to avoid committing", async () => {
    const harness = createHarness({
      patch: { files: [file({ staged: true })] },
      config: { ...defaultConfig, workflow: "graphite" },
    })

    harness.runtime.runAction("graphite-create")

    expect(harness.operations.includes("gt-create:feature/add-file")).toBe(false)
    expect(harness.toasts).toEqual([["warning", "Unstage files before creating a branch-only Graphite stack."]])
  })

  test("Graphite modify generates a message and modifies the current diff", async () => {
    const harness = createHarness({
      patch: { files: [file({ staged: true })] },
      config: { ...defaultConfig, workflow: "graphite" },
    })

    harness.runtime.runAction("graphite-modify")
    await tick()
    harness.confirmCommit({ message: "fix: amend current diff" })
    await tick()

    expect(harness.operations).toContain("staged-stat")
    expect(harness.operations).toContain("staged-diff")
    expect(harness.operations).toContain("gt-modify:fix: amend current diff")
  })

  test("Graphite modify uses native all-changes commit after final message confirmation", async () => {
    const harness = createHarness({
      patch: { files: [file({ unstaged: true })] },
      config: { ...defaultConfig, workflow: "graphite" },
    })

    harness.runtime.runAction("graphite-modify")
    expect(harness.confirmations.length).toBe(1)
    expect(harness.operations.includes("stage-all")).toBe(false)

    harness.confirm()
    await tick()

    expect(harness.operations).toContain("changed-stat")
    expect(harness.operations).toContain("changed-diff")
    expect(harness.operations.includes("stage-all")).toBe(false)

    harness.confirmCommit({ message: "feat: add stack changes" })
    await tick()

    expect(harness.operations).toContain("gt-modify-all:feat: add stack changes")
    expect(harness.operations.includes("gt-modify:feat: add stack changes")).toBe(false)
  })

  test("Graphite modify all-changes workflow skips the confirmation when configured", async () => {
    const harness = createHarness({
      patch: { files: [file({ unstaged: true })] },
      config: { ...defaultConfig, workflow: "graphite", confirmStageAllOnCommit: false },
    })

    harness.runtime.runAction("graphite-modify")
    await tick()
    harness.confirmCommit({ message: "feat: graphite all changes" })
    await tick()

    expect(harness.confirmations.length).toBe(0)
    expect(harness.operations).toContain("changed-stat")
    expect(harness.operations).toContain("gt-modify-all:feat: graphite all changes")
  })

  test("Graphite stack actions use canonical gt commands", async () => {
    const harness = createHarness({ config: { ...defaultConfig, workflow: "graphite" } })

    harness.runtime.runAction("graphite-submit-stack")
    await tick()
    harness.runtime.runAction("graphite-sync")
    await tick()
    harness.runtime.runAction("graphite-up")
    await tick()
    harness.runtime.runAction("graphite-down")
    await tick()

    expect(harness.operations).toContain("gt-submit-stack")
    expect(harness.operations).toContain("gt-sync")
    expect(harness.operations).toContain("gt-up")
    expect(harness.operations).toContain("gt-down")
    expect(harness.operations.filter((op) => op === "gt-log-short").length).toBe(4)
  })
})
