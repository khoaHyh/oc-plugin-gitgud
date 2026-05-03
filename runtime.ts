import type { GitActionValue, GitDialogActionValue } from "./action-catalog"
import { firstLine, type GitFile } from "./change-set"
import {
  commitMessageParts,
  commitMessagePrompt,
  commitMessageSystemWithInstructions,
  textParts,
} from "./commit-message"
import type { GitGudConfig } from "./config"
import type { GitResult } from "./git"
import type { GitGudRefreshInput, GitState, ToastVariant } from "./types"
import { createCommandViewModel, createGitStatusDialogViewModel, createSidebarViewModel } from "./view-model"

export type GitProcessAdapter = Readonly<{
  status: () => Promise<ReadonlyArray<GitFile>>
  stageFile: (file: GitFile) => Promise<GitResult>
  stageAll: () => Promise<GitResult>
  unstageFile: (file: GitFile) => Promise<GitResult>
  unstageAll: () => Promise<GitResult>
  stagedDiff: () => Promise<GitResult>
  stagedStat: () => Promise<GitResult>
  unpushedCommits: () => Promise<number>
  commit: (input: { message: string }) => Promise<GitResult>
  push: () => Promise<GitResult>
}>

export type CommitAgentRequest = Readonly<{
  agent: string
  model: GitGudConfig["commitModel"]
  system: string
  prompt: string
}>

export type GitGudHostAdapter = Readonly<{
  branch: () => string | undefined
  toast: (input: { variant: ToastVariant; message: string }) => void
  confirm: (input: { title: string; message: string; onConfirm: () => void }) => void
  promptCommit: (input: { initial: string; busy: boolean; onConfirm: (value: string) => void }) => void
  showStatus: (runtime: GitGudRuntime) => void
  clearDialog: () => void
  requestCommitMessage: (input: CommitAgentRequest) => Promise<readonly unknown[]>
}>

export type GitGudRuntimeOptions = Readonly<{
  git: GitProcessAdapter
  host: GitGudHostAdapter
  config: GitGudConfig
  state: () => GitState
  setState: (patch: Partial<GitState>) => void
}>

export type GitGudRuntime = Readonly<{
  state: () => GitState
  view: Readonly<{
    sidebar: () => ReturnType<typeof createSidebarViewModel>
    commands: () => ReturnType<typeof createCommandViewModel>
    statusDialog: () => ReturnType<typeof createGitStatusDialogViewModel>
  }>
  refresh: (input?: Partial<GitGudRefreshInput>) => Promise<void>
  runAction: (value: GitActionValue) => void
  runDialogAction: (value: GitDialogActionValue) => void
  selectStatusFile: (path: string) => void
  stageFile: (file: GitFile) => Promise<boolean>
  stageAll: () => Promise<boolean>
  unstageFile: (file: GitFile) => Promise<boolean>
  unstageAll: () => Promise<boolean>
  generateMessage: () => Promise<void>
  showCommit: (initial?: string) => void
  push: () => Promise<void>
  showStatus: () => void
}>

export const createGitGudRuntime = ({ git, host, config, state, setState }: GitGudRuntimeOptions): GitGudRuntime => {
  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

  type RuntimeResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: string }>

  const attempt = async <T>(task: () => Promise<T>): Promise<RuntimeResult<T>> => {
    try {
      return { ok: true, value: await task() }
    } catch (error) {
      return { ok: false, error: errorMessage(error) }
    }
  }

  const refresh: GitGudRuntime["refresh"] = async (input = {}) => {
    const patch = input.patch ?? {}
    if (input.loading ?? true) setState({ loading: true, error: undefined })
    const result = await attempt(() => Promise.all([git.status(), git.unpushedCommits()]))
    if (result.ok) {
      const [files, unpushedCommits] = result.value
      setState({
        ...patch,
        files,
        unpushedCommits,
        branch: host.branch(),
        error: undefined,
        loading: false,
      })
      return
    }

    if (!result.ok) {
      setState({
        ...patch,
        files: [],
        unpushedCommits: 0,
        error: result.error,
        loading: false,
      })
    }
  }

  const mutate = async ({ label, task }: { label: string; task: () => Promise<unknown> }) => {
    if (state().busy) return false
    setState({ busy: true })
    const result = await attempt(task)
    host.toast(result.ok ? { variant: "success", message: label } : { variant: "error", message: result.error })
    await refresh({ patch: { busy: false }, loading: false })
    return result.ok
  }

  const commit = async ({ message }: { message: string }) => {
    const parts = commitMessageParts({ message })
    if (!parts.summary) {
      host.toast({ variant: "warning", message: "Commit message is required." })
      return
    }
    if (await mutate({ label: "Committed staged changes.", task: () => git.commit({ message }) })) {
      setState({ message: "" })
      host.clearDialog()
    }
  }

  const showCommit: GitGudRuntime["showCommit"] = (initial = state().message) => {
    const staged = state().files.filter((file) => file.staged)
    const changed = state().files.length > 0

    if (staged.length === 0 && changed && config.confirmStageAllOnCommit) {
      host.confirm({
        title: "Stage all changes?",
        message: "There are no staged files. Stage all changes before committing?",
        onConfirm: () => {
          void mutate({ label: "Staged all changes.", task: () => git.stageAll() }).then(() => showCommit(initial))
        },
      })
      return
    }

    if (staged.length === 0) {
      host.toast({ variant: "warning", message: "No staged files to commit." })
      return
    }

    host.promptCommit({
      initial,
      busy: state().busy,
      onConfirm: (value) => void commit({ message: value }),
    })
  }

  const generateMessage: GitGudRuntime["generateMessage"] = async () => {
    if (state().busy) return
    setState({ busy: true })
    const result = await attempt(async () => {
      const [stat, diff] = await Promise.all([git.stagedStat(), git.stagedDiff()])
      if (!diff.stdout.trim()) {
        return { kind: "empty" } as const
      }

      const message = textParts({
        parts: await host.requestCommitMessage({
          agent: config.commitAgent,
          model: config.commitModel,
          system: commitMessageSystemWithInstructions({ instructions: config.commitSystemInstructions }),
          prompt: commitMessagePrompt({ stat: stat.stdout, diff: diff.stdout }),
        }),
      })
      if (!message) throw new Error("The model returned an empty commit message")
      return { kind: "message", message } as const
    })

    if (result.ok && result.value.kind === "empty") {
      host.toast({ variant: "warning", message: "No staged changes to describe." })
    } else if (result.ok) {
      setState({ message: result.value.message, busy: false })
      host.toast({ variant: "success", message: "Generated commit message." })
      showCommit(result.value.message)
    } else {
      host.toast({ variant: "error", message: result.error })
    }
    setState({ busy: false })
  }

  const push: GitGudRuntime["push"] = async () => {
    if (state().unpushedCommits === 0) {
      host.toast({ variant: "warning", message: "No unpushed commits to push." })
      return
    }

    const run = () => mutate({ label: "Pushed current branch.", task: () => git.push() })
    if (!config.confirmPush) {
      await run()
      return
    }

    host.confirm({
      title: "Push current branch?",
      message: `Run git push${state().branch ? ` on ${state().branch}` : ""}?`,
      onConfirm: () => void run(),
    })
  }

  const runtime: GitGudRuntime = {
    state,
    view: {
      sidebar: () => createSidebarViewModel({ state: state() }),
      commands: () => createCommandViewModel({ state: state() }),
      statusDialog: () => createGitStatusDialogViewModel({ state: state() }),
    },
    refresh,
    runAction(value) {
      if (value === "open-status") return runtime.showStatus()
      if (value === "stage-all") return void runtime.stageAll()
      if (value === "unstage-all") return void runtime.unstageAll()
      if (value === "commit") return void runtime.generateMessage()
      if (value === "push") return void runtime.push()
      if (value === "refresh") return void runtime.refresh()
    },
    runDialogAction(value) {
      runtime.runAction(value)
    },
    selectStatusFile(path) {
      const file = state().files.find((item) => item.path === path)
      if (!file) return
      if (file.unstaged || file.untracked) {
        void runtime.stageFile(file)
        return
      }
      if (file.staged) void runtime.unstageFile(file)
    },
    stageFile(file) {
      return mutate({ label: `Staged ${firstLine(file.path)}.`, task: () => git.stageFile(file) })
    },
    stageAll() {
      return mutate({ label: "Staged all changes.", task: () => git.stageAll() })
    },
    unstageFile(file) {
      return mutate({ label: `Unstaged ${firstLine(file.path)}.`, task: () => git.unstageFile(file) })
    },
    unstageAll() {
      return mutate({ label: "Unstaged all changes.", task: () => git.unstageAll() })
    },
    generateMessage,
    showCommit,
    push,
    showStatus() {
      host.showStatus(runtime)
      void refresh()
    },
  }

  return runtime
}
