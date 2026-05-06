/** @jsxImportSource @opentui/solid */
import type { TuiCommand, TuiKeybindSet, TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, Show } from "solid-js"
import { defaultGitGudKeybinds } from "./action-catalog"
import type { GitFile } from "./change-set"
import { normalizeConfig } from "./config"
import { createGit } from "./git"
import { createOpenCodeGitGudHostAdapter } from "./host-adapter"
import { createGitGudRuntime, type GitGudRuntime } from "./runtime"
import type { Api, GitState } from "./types"

export type { Api, GitState }
export type { GitGudRuntime }
export type { GitFile }
export type { GitGudRuntime as GitGudActions }

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

const Button = (props: { label: string; onPress: () => void; disabled: boolean; api: Api }) => {
  const theme = createMemo(() => props.api.theme.current)
  const inactive = createMemo(() => props.disabled)

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

const Sidebar = (props: { api: Api; runtime: GitGudRuntime; keybinds: TuiKeybindSet }) => {
  const theme = createMemo(() => props.api.theme.current)
  const view = createMemo(() => props.runtime.view.sidebar())
  const actionsKeybindHint = createMemo(() => {
    const keybind = props.keybinds.get("gitgud.open_status")
    if (keybind === "none") return
    return keybind
  })

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
          <Show when={view().stackSummary}>
            <text fg={theme().textMuted} wrapMode="word">
              {view().stackSummary}
            </text>
          </Show>
          <box flexDirection="row" gap={1}>
            <Button
              api={props.api}
              label="Actions"
              disabled={props.runtime.state().busy}
              onPress={() => props.runtime.showStatus()}
            />
            <Show when={actionsKeybindHint()}>
              <text fg={theme().textMuted}>{actionsKeybindHint()}</text>
            </Show>
          </box>
        </box>
      </Show>
    </box>
  )
}

const slot = ({
  api,
  runtime,
  keybinds,
}: {
  api: Api
  runtime: GitGudRuntime
  keybinds: TuiKeybindSet
}): TuiSlotPlugin => {
  return {
    order: 500,
    slots: {
      sidebar_content() {
        return <Sidebar api={api} runtime={runtime} keybinds={keybinds} />
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
    workflow: optionsValue.workflow === "graphite" ? "graphite" : "git",
    graphite: { available: false, summary: undefined },
    message: "",
    files: [],
    unpushedCommits: 0,
    branch: api.state.vcs?.branch,
    error: undefined,
  })
  const setState = (patch: Partial<GitState>) => setStateValue((value) => ({ ...value, ...patch }))
  const host = createOpenCodeGitGudHostAdapter({ api })
  const runtime = createGitGudRuntime({
    git: createGit({ api }),
    host,
    config: optionsValue,
    state,
    setState,
  })
  await host.install({
    runtime,
    options: optionsValue,
    commands: () => commands({ runtime, keybinds }),
    slot: slot({ api, runtime, keybinds }),
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "gitgud",
  tui,
}

export default plugin
