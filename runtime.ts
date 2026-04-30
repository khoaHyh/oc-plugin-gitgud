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
import type { GitState, ToastVariant } from "./types"
import { createCommandViewModel, createGitStatusDialogViewModel, createSidebarViewModel } from "./view-model"

export type GitProcessAdapter = {
  status: () => Promise<GitFile[]>
  stageFile: (file: GitFile) => Promise<GitResult>
  stageAll: () => Promise<GitResult>
  unstageFile: (file: GitFile) => Promise<GitResult>
  unstageAll: () => Promise<GitResult>
  stagedDiff: () => Promise<GitResult>
  stagedStat: () => Promise<GitResult>
  commit: (message: string) => Promise<GitResult>
  push: () => Promise<GitResult>
}

export type CommitAgentRequest = {
  agent: string
  model?: GitGudConfig["commitModel"]
  system: string
  prompt: string
}

export type GitGudHostAdapter = {
  branch: () => string | undefined
  toast: (variant: ToastVariant, message: string) => void
  confirm: (input: { title: string; message: string; onConfirm: () => void }) => void
  promptCommit: (input: { initial: string; busy: boolean; onConfirm: (value: string) => void }) => void
  showStatus: (runtime: GitGudRuntime) => void
  clearDialog: () => void
  requestCommitMessage: (input: CommitAgentRequest) => Promise<readonly unknown[]>
}

export type GitGudRuntimeOptions = {
  git: GitProcessAdapter
  host: GitGudHostAdapter
  config: GitGudConfig
  state: () => GitState
  setState: (patch: Partial<GitState>) => void
}

export type GitGudRuntime = {
  state: () => GitState
  view: {
    sidebar: () => ReturnType<typeof createSidebarViewModel>
    commands: () => ReturnType<typeof createCommandViewModel>
    statusDialog: () => ReturnType<typeof createGitStatusDialogViewModel>
  }
  refresh: (patch?: Partial<GitState>, options?: { loading?: boolean }) => Promise<void>
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
}

export const createGitGudRuntime = ({ git, host, config, state, setState }: GitGudRuntimeOptions): GitGudRuntime => {
  const refresh: GitGudRuntime["refresh"] = async (patch = {}, options) => {
    if (options?.loading ?? true) setState({ loading: true, error: undefined })
    try {
      setState({
        ...patch,
        files: await git.status(),
        branch: host.branch(),
        error: undefined,
        loading: false,
      })
    } catch (err) {
      setState({
        ...patch,
        files: [],
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      })
    }
  }

  const mutate = async (label: string, task: () => Promise<unknown>) => {
    if (state().busy) return false
    setState({ busy: true })
    try {
      await task()
      host.toast("success", label)
      return true
    } catch (err) {
      host.toast("error", err instanceof Error ? err.message : String(err))
      return false
    } finally {
      await refresh({ busy: false }, { loading: false })
    }
  }

  const commit = async (message: string) => {
    const parts = commitMessageParts(message)
    if (!parts.summary) {
      host.toast("warning", "Commit message is required.")
      return
    }
    if (await mutate("Committed staged changes.", () => git.commit(message))) {
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
          void mutate("Staged all changes.", () => git.stageAll()).then(() => showCommit(initial))
        },
      })
      return
    }

    if (staged.length === 0) {
      host.toast("warning", "No staged files to commit.")
      return
    }

    host.promptCommit({
      initial,
      busy: state().busy,
      onConfirm: (value) => void commit(value),
    })
  }

  const generateMessage: GitGudRuntime["generateMessage"] = async () => {
    if (state().busy) return
    setState({ busy: true })
    try {
      const [stat, diff] = await Promise.all([git.stagedStat(), git.stagedDiff()])
      if (!diff.stdout.trim()) {
        host.toast("warning", "No staged changes to describe.")
        return
      }

      const message = textParts(
        await host.requestCommitMessage({
          agent: config.commitAgent,
          model: config.commitModel,
          system: commitMessageSystemWithInstructions(config.commitSystemInstructions),
          prompt: commitMessagePrompt(stat.stdout, diff.stdout),
        }),
      )
      if (!message) throw new Error("The model returned an empty commit message")
      setState({ message, busy: false })
      host.toast("success", "Generated commit message.")
      showCommit(message)
    } catch (err) {
      host.toast("error", err instanceof Error ? err.message : String(err))
    } finally {
      setState({ busy: false })
    }
  }

  const push: GitGudRuntime["push"] = async () => {
    const run = () => mutate("Pushed current branch.", () => git.push())
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
      sidebar: () => createSidebarViewModel(state()),
      commands: () => createCommandViewModel(state()),
      statusDialog: () => createGitStatusDialogViewModel(state()),
    },
    refresh,
    runAction(value) {
      if (value === "open-status") return runtime.showStatus()
      if (value === "stage-all") return void runtime.stageAll()
      if (value === "unstage-all") return void runtime.unstageAll()
      if (value === "generate-commit-message") return void runtime.generateMessage()
      if (value === "commit") return runtime.showCommit()
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
      return mutate(`Staged ${firstLine(file.path)}.`, () => git.stageFile(file))
    },
    stageAll() {
      return mutate("Staged all changes.", () => git.stageAll())
    },
    unstageFile(file) {
      return mutate(`Unstaged ${firstLine(file.path)}.`, () => git.unstageFile(file))
    },
    unstageAll() {
      return mutate("Unstaged all changes.", () => git.unstageAll())
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
