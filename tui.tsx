/** @jsxImportSource @opentui/solid */
import type { TuiCommand, TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, Show } from "solid-js"
import { gitActionCatalog, gitCommandValue, type GitActionValue } from "./action-catalog"
import { firstLine, type GitFile } from "./change-set"
import { commitMessageParts, commitMessagePrompt, commitMessageSystem, textParts } from "./commit-message"
import { normalizeConfig, type GitGudConfig } from "./config"
import { createGit } from "./git"
import { GitStatusDialog } from "./status-dialog"
import type { Api, GitGudActions, GitState, ToastVariant } from "./types"

const id = "gitgud"

export type { Api, GitGudActions, GitState }
export type { GitFile }

export const createActions = (
  api: Api,
  options: GitGudConfig,
  state: () => GitState,
  setState: (patch: Partial<GitState>) => void,
): GitGudActions => {
  const git = createGit(api)

  const responseErrorMessage = (err: unknown, fallback: string) => {
    if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message
    if (err && typeof err === "object" && "data" in err) {
      const data = err.data
      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message
    }
    return fallback
  }

  const toast = (variant: ToastVariant, message: string) => {
    api.ui.toast({ variant, message })
  }

  const refresh: GitGudActions["refresh"] = async (patch = {}, options) => {
    if (options?.loading ?? true) setState({ loading: true, error: undefined })
    try {
      setState({
        ...patch,
        files: await git.status(),
        branch: api.state.vcs?.branch,
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
      toast("success", label)
      return true
    } catch (err) {
      toast("error", err instanceof Error ? err.message : String(err))
      return false
    } finally {
      await refresh({ busy: false }, { loading: false })
    }
  }

  const commit = async (message: string) => {
    const parts = commitMessageParts(message)
    if (!parts.summary) {
      toast("warning", "Commit message is required.")
      return
    }
    if (await mutate("Committed staged changes.", () => git.commit(message))) {
      setState({ message: "" })
      api.ui.dialog.clear()
    }
  }

  const showCommit = (initial = state().message) => {
    const staged = state().files.filter((file) => file.staged)
    const changed = state().files.length > 0

    if (staged.length === 0 && changed && options.confirmStageAllOnCommit) {
      api.ui.dialog.replace(() => (
        <api.ui.DialogConfirm
          title="Stage all changes?"
          message="There are no staged files. Stage all changes before committing?"
          onConfirm={() => {
            void mutate("Staged all changes.", () => git.stageAll()).then(() => showCommit(initial))
          }}
        />
      ))
      return
    }

    if (staged.length === 0) {
      toast("warning", "No staged files to commit.")
      return
    }

    api.ui.dialog.replace(() => (
      <api.ui.DialogPrompt
        title="Commit staged changes"
        placeholder="commit message"
        value={initial}
        busy={state().busy}
        busyText="committing"
        onConfirm={(value) => void commit(value)}
      />
    ))
  }

  const generateMessage = async () => {
    if (state().busy) return
    setState({ busy: true })
    let sessionID = ""
    try {
      const [stat, diff] = await Promise.all([git.stagedStat(), git.stagedDiff()])
      if (!diff.stdout.trim()) {
        toast("warning", "No staged changes to describe.")
        return
      }

      const session = await api.client.session.create({ title: "GitGud commit message" })
      if (session.error) throw new Error(responseErrorMessage(session.error, "Failed to create commit message session"))
      sessionID = session.data.id

      const response = await api.client.session.prompt({
        sessionID,
        agent: options.commitAgent,
        system: commitMessageSystem,
        parts: [
          {
            type: "text",
            text: commitMessagePrompt(stat.stdout, diff.stdout),
          },
        ],
      })

      if (response.error) throw new Error(responseErrorMessage(response.error, "Failed to generate commit message"))

      const message = textParts(response.data.parts)
      if (!message) throw new Error("The model returned an empty commit message")
      setState({ message })
      toast("success", "Generated commit message.")
      showCommit(message)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : String(err))
    } finally {
      if (sessionID) void api.client.session.delete({ sessionID }).catch(() => {})
      setState({ busy: false })
    }
  }

  const push = async () => {
    const run = () => mutate("Pushed current branch.", () => git.push())
    if (!options.confirmPush) {
      await run()
      return
    }

    api.ui.dialog.replace(() => (
      <api.ui.DialogConfirm
        title="Push current branch?"
        message={`Run git push${state().branch ? ` on ${state().branch}` : ""}?`}
        onConfirm={() => void run()}
      />
    ))
  }

  const actions: GitGudActions = {
    refresh,
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
      api.ui.dialog.replace(() => <GitStatusDialog api={api} state={state} actions={actions} />)
      api.ui.dialog.setSize("large")
      void refresh()
    },
  }

  return actions
}

const runAction = (value: GitActionValue, actions: GitGudActions) => {
  if (value === "open-status") return actions.showStatus()
  if (value === "stage-all") return void actions.stageAll()
  if (value === "unstage-all") return void actions.unstageAll()
  if (value === "generate-commit-message") return void actions.generateMessage()
  if (value === "commit") return actions.showCommit()
  if (value === "push") return void actions.push()
  if (value === "refresh") return void actions.refresh()
}

const commands = (state: () => GitState, actions: GitGudActions): TuiCommand[] => {
  return gitActionCatalog.map((item) => ({
    title: item.commandTitle,
    value: gitCommandValue(item.value),
    category: item.category,
    enabled: item.enabled(state()),
    onSelect() {
      runAction(item.value, actions)
    },
  }))
}

const Button = (props: { label: string; onPress: () => void; disabled?: boolean; muted?: boolean; api: Api }) => {
  const theme = createMemo(() => props.api.theme.current)
  return (
    <text
      fg={props.disabled || props.muted ? theme().textMuted : theme().primary}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onMouseUp={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!props.disabled) props.onPress()
      }}
    >
      [{props.label}]
    </text>
  )
}

const Sidebar = (props: { api: Api; state: () => GitState; actions: GitGudActions }) => {
  const theme = createMemo(() => props.api.theme.current)
  const staged = createMemo(() => props.state().files.filter((file) => file.staged))
  const unstaged = createMemo(() => props.state().files.filter((file) => file.unstaged || file.untracked))
  const hasFiles = createMemo(() => props.state().files.length > 0)
  const summary = createMemo(() => {
    const dirty = props.state().files.length
    return `${dirty} dirty · ${unstaged().length} unstaged · ${staged().length} staged`
  })

  return (
    <box gap={1}>
      <text fg={theme().text}>
        <b>GitGud</b>
      </text>
      <Show when={props.state().error}>
        <text fg={theme().error} wrapMode="word">
          GitGud: {props.state().error}
        </text>
      </Show>
      <Show when={hasFiles()}>
        <text fg={theme().textMuted}>{summary()}</text>
        <box flexDirection="row" gap={1}>
          <Button api={props.api} label="open" disabled={props.state().busy} onPress={props.actions.showStatus} />
          <Button
            api={props.api}
            label="msg"
            disabled={props.state().busy || staged().length === 0}
            onPress={props.actions.generateMessage}
          />
          <Button
            api={props.api}
            label="commit"
            disabled={props.state().busy}
            onPress={() => props.actions.showCommit()}
          />
          <Button api={props.api} label="push" disabled={props.state().busy} onPress={props.actions.push} />
        </box>
      </Show>
      <Show when={!hasFiles() && !props.state().error}>
        <text fg={theme().textMuted}>0 dirty · 0 unstaged · 0 staged</text>
        <box flexDirection="row" gap={1}>
          <Button api={props.api} label="open" disabled={props.state().busy} onPress={props.actions.showStatus} />
          <Button api={props.api} label="msg" disabled={true} onPress={props.actions.generateMessage} />
          <Button
            api={props.api}
            label="commit"
            disabled={props.state().busy}
            onPress={() => props.actions.showCommit()}
          />
          <Button api={props.api} label="push" disabled={props.state().busy} onPress={props.actions.push} />
        </box>
      </Show>
    </box>
  )
}

const slot = (api: Api, state: () => GitState, actions: GitGudActions): TuiSlotPlugin => {
  return {
    order: 500,
    slots: {
      sidebar_content() {
        return <Sidebar api={api} state={state} actions={actions} />
      },
    },
  }
}

const tui: TuiPlugin = async (api, options) => {
  const optionsValue = normalizeConfig(options)
  if (!optionsValue.enabled) return

  const [state, setStateValue] = createSignal<GitState>({
    loading: true,
    busy: false,
    message: "",
    files: [],
    branch: api.state.vcs?.branch,
  })
  const setState = (patch: Partial<GitState>) => setStateValue((value) => ({ ...value, ...patch }))
  const actions = createActions(api, optionsValue, state, setState)

  let replacedSidebarFiles = false
  if (optionsValue.replaceSidebarFiles) {
    const item = api.plugins.list().find((entry) => entry.id === "internal:sidebar-files")
    if (item?.enabled && item.active) {
      replacedSidebarFiles = await api.plugins.deactivate("internal:sidebar-files")
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const scheduleRefresh = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void actions.refresh(), 150)
  }

  const unwatchFile = api.event.on("file.watcher.updated", scheduleRefresh)
  const unwatchVcs = api.event.on("vcs.branch.updated", scheduleRefresh)

  api.command.register(() => commands(state, actions))
  api.slots.register(slot(api, state, actions))
  await actions.refresh()

  api.lifecycle.onDispose(async () => {
    if (timer) clearTimeout(timer)
    unwatchFile()
    unwatchVcs()
    if (replacedSidebarFiles) {
      await api.plugins.activate("internal:sidebar-files")
    }
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
