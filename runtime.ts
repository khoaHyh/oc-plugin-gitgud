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
  changedDiff: () => Promise<GitResult>
  changedStat: () => Promise<GitResult>
  unpushedCommits: () => Promise<number>
  commit: (input: { message: string }) => Promise<GitResult>
  push: () => Promise<GitResult>
  graphiteLogShort: () => Promise<GitResult>
  graphiteCreate: (input: { branch: string }) => Promise<GitResult>
  graphiteModify: (input: { message: string }) => Promise<GitResult>
  graphiteModifyAll: (input: { message: string }) => Promise<GitResult>
  graphiteSubmitStack: () => Promise<GitResult>
  graphiteSync: () => Promise<GitResult>
  graphiteUp: () => Promise<GitResult>
  graphiteDown: () => Promise<GitResult>
}>

export type CommitAgentRequest = Readonly<{
  agent: string | undefined
  model: GitGudConfig["commitModel"]
  system: string
  prompt: string
}>

export type GitGudHostAdapter = Readonly<{
  branch: () => string | undefined
  toast: (input: { variant: ToastVariant; message: string }) => void
  confirm: (input: { title: string; message: string; onConfirm: () => void }) => void
  promptText: (input: {
    title: string
    placeholder: string
    initial: string
    busy: boolean
    busyText: string
    onConfirm: (value: string) => void
  }) => void
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
  type WorkflowState = Readonly<Pick<GitState, "workflow" | "graphite">>
  type RefreshRequest = Readonly<{
    patch: Partial<GitState>
    loading: boolean
    probeGraphite: boolean
  }>

  const attempt = async <T>(task: () => Promise<T>): Promise<RuntimeResult<T>> => {
    try {
      return { ok: true, value: await task() }
    } catch (error) {
      return { ok: false, error: errorMessage(error) }
    }
  }

  const gitWorkflowState = () => {
    return { workflow: "git", graphite: { available: false, summary: undefined } } as const
  }

  const currentWorkflowState = (): WorkflowState => {
    if (config.workflow === "git") return gitWorkflowState()
    if (config.workflow === "graphite") return { workflow: "graphite", graphite: state().graphite }
    return { workflow: state().workflow, graphite: state().graphite }
  }

  const graphiteState = async ({ probeGraphite }: { probeGraphite: boolean }): Promise<WorkflowState> => {
    if (!probeGraphite) return currentWorkflowState()
    if (config.workflow === "git") return gitWorkflowState()

    const result = await git.graphiteLogShort()
    const available = result.code === 0
    if (config.workflow === "graphite") {
      return {
        workflow: "graphite",
        graphite: { available, summary: available ? result.stdout.trim() || undefined : undefined },
      } as const
    }

    if (!available) return gitWorkflowState()
    return {
      workflow: "graphite",
      graphite: { available: true, summary: result.stdout.trim() || undefined },
    } as const
  }

  const normalizeRefreshInput = (input: Partial<GitGudRefreshInput>): RefreshRequest => {
    return {
      patch: input.patch ?? {},
      loading: input.loading ?? true,
      probeGraphite: input.probeGraphite ?? true,
    }
  }

  const mergeRefreshRequest = (current: RefreshRequest | undefined, next: RefreshRequest): RefreshRequest => {
    if (!current) return next
    return {
      patch: { ...current.patch, ...next.patch },
      loading: current.loading || next.loading,
      probeGraphite: current.probeGraphite || next.probeGraphite,
    }
  }

  const refreshErrorPatch = ({ probeGraphite }: { probeGraphite: boolean }): Partial<GitState> => {
    if (probeGraphite) return { graphite: { available: false, summary: undefined } }
    return currentWorkflowState()
  }

  const runRefresh = async (request: RefreshRequest) => {
    const { patch, loading, probeGraphite } = request
    if (loading) setState({ loading: true, error: undefined })
    const result = await attempt(() =>
      Promise.all([git.status(), git.unpushedCommits(), graphiteState({ probeGraphite })]),
    )
    if (result.ok) {
      const [files, unpushedCommits, workflow] = result.value
      setState({
        ...patch,
        ...workflow,
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
        ...refreshErrorPatch({ probeGraphite }),
        error: result.error,
        loading: false,
      })
    }
  }

  let activeRefresh: Promise<void> | undefined
  let queuedRefresh: RefreshRequest | undefined

  const refresh: GitGudRuntime["refresh"] = async (input = {}) => {
    const request = normalizeRefreshInput(input)
    if (activeRefresh) {
      queuedRefresh = mergeRefreshRequest(queuedRefresh, request)
      return activeRefresh
    }

    activeRefresh = (async () => {
      let next: RefreshRequest | undefined = request
      while (next) {
        const current = next
        queuedRefresh = undefined
        await runRefresh(current)
        next = queuedRefresh
      }
    })()

    try {
      await activeRefresh
    } finally {
      activeRefresh = undefined
    }
  }

  const mutate = async ({
    label,
    task,
    probeGraphite,
  }: {
    label: string
    task: () => Promise<unknown>
    probeGraphite: boolean
  }) => {
    if (state().busy) return false
    setState({ busy: true })
    const result = await attempt(task)
    host.toast(result.ok ? { variant: "success", message: label } : { variant: "error", message: result.error })
    await refresh({ patch: { busy: false }, loading: false, probeGraphite })
    return result.ok
  }

  const commit = async ({ message }: { message: string }) => {
    const parts = commitMessageParts({ message })
    if (!parts.summary) {
      host.toast({ variant: "warning", message: "Commit message is required." })
      return
    }
    if (
      await mutate({ label: "Committed staged changes.", task: () => git.commit({ message }), probeGraphite: false })
    ) {
      setState({ message: "" })
      host.clearDialog()
    }
  }

  const commitAll = async ({ message }: { message: string }) => {
    const parts = commitMessageParts({ message })
    if (!parts.summary) {
      host.toast({ variant: "warning", message: "Commit message is required." })
      return
    }
    if (
      await mutate({
        label: "Committed all changes.",
        task: async () => {
          await git.stageAll()
          return git.commit({ message })
        },
        probeGraphite: false,
      })
    ) {
      setState({ message: "" })
      host.clearDialog()
    }
  }

  const validMessage = ({ message }: { message: string }) => {
    const parts = commitMessageParts({ message })
    if (parts.summary) return true
    host.toast({ variant: "warning", message: "Commit message is required." })
    return false
  }

  const promptMessage = ({
    title,
    initial,
    busyText,
    onConfirm,
  }: {
    title: string
    initial: string
    busyText: string
    onConfirm: (value: string) => void
  }) => {
    host.promptText({
      title,
      placeholder: "commit message",
      initial,
      busy: state().busy,
      busyText,
      onConfirm,
    })
  }

  const showCommitPrompt = ({ initial, allChanges }: { initial: string; allChanges: boolean }) => {
    promptMessage({
      title: allChanges ? "Commit all changes" : "Commit staged changes",
      initial,
      busyText: "committing",
      onConfirm: (value) => void (allChanges ? commitAll({ message: value }) : commit({ message: value })),
    })
  }

  const showCommit: GitGudRuntime["showCommit"] = (initial = state().message) => {
    const staged = state().files.filter((file) => file.staged)
    const changed = state().files.length > 0

    if (staged.length === 0 && changed && config.confirmStageAllOnCommit) {
      host.confirm({
        title: "Commit all changes?",
        message: "There are no staged files. Commit all changed files?",
        onConfirm: () => {
          showCommitPrompt({ initial, allChanges: true })
        },
      })
      return
    }

    if (staged.length === 0) {
      host.toast({ variant: "warning", message: "No staged files to commit." })
      return
    }

    showCommitPrompt({ initial, allChanges: false })
  }

  const generateMessageFromDiff = async ({ scope }: { scope: "staged" | "changed" }) => {
    if (state().busy) return
    setState({ busy: true })
    const result = await attempt(async () => {
      const [stat, diff] = await Promise.all(
        scope === "staged" ? [git.stagedStat(), git.stagedDiff()] : [git.changedStat(), git.changedDiff()],
      )
      const untracked =
        scope === "changed"
          ? state()
              .files.filter((file) => file.untracked)
              .map((file) => file.path)
          : []
      const diffText = [
        diff.stdout,
        untracked.length ? `\nUNTRACKED FILES:\n${untracked.map((path) => `- ${path}`).join("\n")}` : "",
      ].join("")
      if (!diffText.trim()) {
        return { kind: "empty" } as const
      }

      const message = textParts({
        parts: await host.requestCommitMessage({
          agent: config.commitAgent,
          model: config.commitModel,
          system: commitMessageSystemWithInstructions({ instructions: config.commitSystemInstructions }),
          prompt: commitMessagePrompt({ stat: stat.stdout, diff: diffText }),
        }),
      })
      if (!message) throw new Error("The model returned an empty commit message")
      return { kind: "message", message } as const
    })

    if (result.ok && result.value.kind === "empty") {
      host.toast({
        variant: "warning",
        message: scope === "staged" ? "No staged changes to describe." : "No changes to describe.",
      })
    } else if (result.ok) {
      setState({ message: result.value.message, busy: false })
    } else {
      host.toast({ variant: "error", message: result.error })
    }
    setState({ busy: false })
    return result.ok && result.value.kind === "message" ? result.value.message : undefined
  }

  const generateMessage: GitGudRuntime["generateMessage"] = async () => {
    const message = await generateMessageFromDiff({ scope: "staged" })
    if (!message) return
    setState({ message, busy: false })
    host.toast({ variant: "success", message: "Generated commit message." })
    showCommit(message)
  }

  const openAllChangesCommit = () => {
    void generateMessageFromDiff({ scope: "changed" }).then((message) => {
      if (!message) return
      showCommitPrompt({ initial: message, allChanges: true })
    })
  }

  const generateAllChangesCommit = () => {
    if (state().busy) return
    if (!config.confirmStageAllOnCommit) {
      openAllChangesCommit()
      return
    }
    host.confirm({
      title: "Commit all changes?",
      message: "There are no staged files. Commit all changed files?",
      onConfirm: openAllChangesCommit,
    })
  }

  const showGraphiteCreate = () => {
    if (!state().graphite.available) {
      host.toast({ variant: "warning", message: "Graphite CLI is not available for this repository." })
      return
    }
    if (state().files.some((file) => file.staged)) {
      host.toast({ variant: "warning", message: "Unstage files before creating a branch-only Graphite stack." })
      return
    }

    host.promptText({
      title: "Create Graphite branch",
      placeholder: "branch name",
      initial: "",
      busy: state().busy,
      busyText: "creating",
      onConfirm: (rawBranch) => {
        const branch = rawBranch.trim()
        if (!branch) {
          host.toast({ variant: "warning", message: "Branch name is required." })
          return
        }
        void mutate({
          label: `Created Graphite branch ${firstLine(branch)}.`,
          task: () => git.graphiteCreate({ branch }),
          probeGraphite: true,
        }).then((ok) => {
          if (ok) host.clearDialog()
        })
      },
    })
  }

  const showGraphiteModify = () => {
    if (!state().graphite.available) {
      host.toast({ variant: "warning", message: "Graphite CLI is not available for this repository." })
      return
    }
    const staged = state().files.filter((file) => file.staged)
    const changed = state().files.length > 0
    const promptModify = ({ message, allChanges }: { message: string; allChanges: boolean }) => {
      promptMessage({
        title: allChanges ? "Modify current diff with all changes" : "Modify current diff",
        initial: message,
        busyText: "modifying",
        onConfirm: (value) => {
          if (!validMessage({ message: value })) return
          void mutate({
            label: "Modified current diff.",
            task: () =>
              allChanges ? git.graphiteModifyAll({ message: value }) : git.graphiteModify({ message: value }),
            probeGraphite: true,
          }).then((ok) => {
            if (ok) {
              setState({ message: "" })
              host.clearDialog()
            }
          })
        },
      })
    }
    const openAllChangesModify = () => {
      void generateMessageFromDiff({ scope: "changed" }).then((message) => {
        if (!message) return
        promptModify({ message, allChanges: true })
      })
    }
    if (staged.length === 0 && changed) {
      if (!config.confirmStageAllOnCommit) {
        openAllChangesModify()
        return
      }
      host.confirm({
        title: "Modify with all changes?",
        message: "There are no staged files. Modify the current diff with all changed files?",
        onConfirm: openAllChangesModify,
      })
      return
    }
    if (staged.length === 0) {
      host.toast({ variant: "warning", message: "No staged files to modify." })
      return
    }

    void generateMessageFromDiff({ scope: "staged" }).then((message) => {
      if (!message) return
      promptModify({ message, allChanges: false })
    })
  }

  const graphiteMutation = ({ label, task }: { label: string; task: () => Promise<GitResult> }) => {
    if (!state().graphite.available) {
      host.toast({ variant: "warning", message: "Graphite CLI is not available for this repository." })
      return
    }
    void mutate({ label, task, probeGraphite: true })
  }

  const push: GitGudRuntime["push"] = async () => {
    if (state().unpushedCommits === 0) {
      host.toast({ variant: "warning", message: "No unpushed commits to push." })
      return
    }

    const run = () => mutate({ label: "Pushed current branch.", task: () => git.push(), probeGraphite: false })
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
      if (value === "commit") {
        if (!state().files.some((file) => file.staged) && state().files.length > 0) return generateAllChangesCommit()
        return void runtime.generateMessage()
      }
      if (value === "push") return void runtime.push()
      if (value === "graphite-create") return showGraphiteCreate()
      if (value === "graphite-modify") return showGraphiteModify()
      if (value === "graphite-submit-stack") {
        return graphiteMutation({ label: "Submitted stack.", task: () => git.graphiteSubmitStack() })
      }
      if (value === "graphite-sync") return graphiteMutation({ label: "Synced stack.", task: () => git.graphiteSync() })
      if (value === "graphite-up") return graphiteMutation({ label: "Moved up stack.", task: () => git.graphiteUp() })
      if (value === "graphite-down")
        return graphiteMutation({ label: "Moved down stack.", task: () => git.graphiteDown() })
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
      return mutate({ label: `Staged ${firstLine(file.path)}.`, task: () => git.stageFile(file), probeGraphite: false })
    },
    stageAll() {
      return mutate({ label: "Staged all changes.", task: () => git.stageAll(), probeGraphite: false })
    },
    unstageFile(file) {
      return mutate({
        label: `Unstaged ${firstLine(file.path)}.`,
        task: () => git.unstageFile(file),
        probeGraphite: false,
      })
    },
    unstageAll() {
      return mutate({ label: "Unstaged all changes.", task: () => git.unstageAll(), probeGraphite: false })
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
