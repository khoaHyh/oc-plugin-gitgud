/** @jsxImportSource @opentui/solid */
import type { TuiCommand, TuiKeybindSet, TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, Show } from "solid-js"
import { defaultGitGudKeybinds } from "./action-catalog"
import type { GitFile } from "./change-set"
import { normalizeConfig, type GitGudConfig } from "./config"
import { createGit } from "./git"
import { createGitGudRuntime, type GitGudHostAdapter, type GitGudRuntime } from "./runtime"
import { GitStatusDialog } from "./status-dialog"
import type { Api, GitState } from "./types"

export type { Api, GitState }
export type { GitGudRuntime }
export type { GitFile }
export type { GitGudRuntime as GitGudActions }

type OpenCodeGitGudHostAdapter = GitGudHostAdapter & {
  install: (runtime: GitGudRuntime, keybinds: TuiKeybindSet, options: GitGudConfig) => Promise<void>
}

const createHostAdapter = (api: Api): OpenCodeGitGudHostAdapter => {
  const responseErrorMessage = (err: unknown, fallback: string) => {
    if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message
    if (err && typeof err === "object" && "data" in err) {
      const data = err.data
      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message
    }
    return fallback
  }

  return {
    branch: () => api.state.vcs?.branch,
    toast: (variant, message) => api.ui.toast({ variant, message }),
    confirm(input) {
      api.ui.dialog.replace(() => <api.ui.DialogConfirm {...input} />)
    },
    promptCommit(input) {
      api.ui.dialog.replace(() => (
        <api.ui.DialogPrompt
          title="Commit staged changes"
          placeholder="commit message"
          value={input.initial}
          busy={input.busy}
          busyText="committing"
          onConfirm={input.onConfirm}
        />
      ))
    },
    showStatus(runtime) {
      api.ui.dialog.replace(() => <GitStatusDialog api={api} runtime={runtime} />)
      api.ui.dialog.setSize("large")
    },
    clearDialog: () => api.ui.dialog.clear(),
    async requestCommitMessage(input) {
      let sessionID = ""
      const session = await api.client.session.create({ title: "GitGud commit message" })
      if (session.error) throw new Error(responseErrorMessage(session.error, "Failed to create commit message session"))
      sessionID = session.data.id
      try {
        const response = await api.client.session.prompt({
          sessionID,
          agent: input.agent,
          model: input.model,
          system: input.system,
          parts: [{ type: "text", text: input.prompt }],
        })
        if (response.error) throw new Error(responseErrorMessage(response.error, "Failed to generate commit message"))
        return response.data.parts
      } finally {
        if (sessionID) void api.client.session.delete({ sessionID }).catch(() => {})
      }
    },
    async install(runtime, keybinds, options) {
      let replacedSidebarFiles = false
      if (options.replaceSidebarFiles) {
        const item = api.plugins.list().find((entry) => entry.id === "internal:sidebar-files")
        if (item?.enabled && item.active) {
          replacedSidebarFiles = await api.plugins.deactivate("internal:sidebar-files")
        }
      }

      let timer: ReturnType<typeof setTimeout> | undefined
      const scheduleRefresh = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void runtime.refresh(), 150)
      }

      const unwatchFile = api.event.on("file.watcher.updated", scheduleRefresh)
      const unwatchVcs = api.event.on("vcs.branch.updated", scheduleRefresh)

      api.command.register(() => commands({ runtime, keybinds }))
      api.slots.register(slot({ api, runtime }))
      await runtime.refresh()

      api.lifecycle.onDispose(async () => {
        if (timer) clearTimeout(timer)
        unwatchFile()
        unwatchVcs()
        if (replacedSidebarFiles) {
          await api.plugins.activate("internal:sidebar-files")
        }
      })
    },
  }
}

const commands = ({ runtime, keybinds }: { runtime: GitGudRuntime; keybinds: TuiKeybindSet }): TuiCommand[] => {
  return runtime.view.commands().map((item) => {
    const keybind = keybinds.get(item.keybindName)
    return {
      title: item.title,
      value: item.value,
      category: item.category,
      keybind: keybind === "none" ? undefined : keybind,
      enabled: item.enabled,
      onSelect() {
        runtime.runAction(item.action)
      },
    }
  })
}

const Button = (props: { label: string; onPress: () => void; disabled?: boolean; muted?: boolean; api: Api }) => {
  const theme = createMemo(() => props.api.theme.current)
  const inactive = createMemo(() => props.disabled || props.muted)

  return (
    <box
      backgroundColor={inactive() ? theme().background : theme().primary}
      height={1}
      width={props.label.length + 2}
      alignItems="center"
      justifyContent="center"
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
      <text
        fg={inactive() ? theme().textMuted : theme().selectedListItemText}
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
        {props.label}
      </text>
    </box>
  )
}

const Sidebar = (props: { api: Api; runtime: GitGudRuntime }) => {
  const theme = createMemo(() => props.api.theme.current)
  const view = createMemo(() => props.runtime.view.sidebar())

  return (
    <box>
      <text fg={theme().text}>
        <b>{view().title}</b>
      </text>
      <Show when={view().error}>
        <text fg={theme().error} wrapMode="word">
          GitGud: {view().error}
        </text>
      </Show>
      <Show when={view().hasFiles || !view().error}>
        <box gap={1}>
          <text fg={theme().textMuted}>{view().summary}</text>
          <box flexDirection="row" gap={1}>
            {view().buttons.map((button) => (
              <Button
                api={props.api}
                label={button.label}
                disabled={button.disabled}
                onPress={() => props.runtime.runAction(button.action)}
              />
            ))}
          </box>
        </box>
      </Show>
    </box>
  )
}

const slot = ({ api, runtime }: { api: Api; runtime: GitGudRuntime }): TuiSlotPlugin => {
  return {
    order: 500,
    slots: {
      sidebar_content() {
        return <Sidebar api={api} runtime={runtime} />
      },
    },
  }
}

const tui: TuiPlugin = async (api, options) => {
  const optionsValue = normalizeConfig(options)
  if (!optionsValue.enabled) return
  const keybinds = api.keybind.create(defaultGitGudKeybinds, optionsValue.keybinds)

  const [state, setStateValue] = createSignal<GitState>({
    loading: true,
    busy: false,
    message: "",
    files: [],
    unpushedCommits: 0,
    branch: api.state.vcs?.branch,
  })
  const setState = (patch: Partial<GitState>) => setStateValue((value) => ({ ...value, ...patch }))
  const host = createHostAdapter(api)
  const runtime = createGitGudRuntime({
    git: createGit(api),
    host,
    config: optionsValue,
    state,
    setState,
  })
  await host.install(runtime, keybinds, optionsValue)
}

const plugin: TuiPluginModule & { id: string } = {
  id: "gitgud",
  tui,
}

export default plugin
