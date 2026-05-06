/** @jsxImportSource @opentui/solid */
import type { TuiCommand, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { GitStatusDialog } from "./status-dialog"
import type { GitGudConfig } from "./config"
import type { GitGudHostAdapter, GitGudRuntime } from "./runtime"
import type { Api, GitGudRefreshInput } from "./types"

export type OpenCodeGitGudHostAdapter = GitGudHostAdapter &
  Readonly<{
    install: (input: {
      runtime: GitGudRuntime
      options: GitGudConfig
      commands: () => TuiCommand[]
      slot: TuiSlotPlugin
    }) => Promise<void>
  }>

const responseErrorMessage = ({ err, fallback }: { err: unknown; fallback: string }) => {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message
  if (err && typeof err === "object" && "data" in err) {
    const data = err.data
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message
  }
  return fallback
}

const mergeRefreshInput = (
  current: Partial<GitGudRefreshInput> | undefined,
  next: Partial<GitGudRefreshInput>,
): Partial<GitGudRefreshInput> => {
  if (!current) return next
  return {
    patch: { ...(current.patch ?? {}), ...(next.patch ?? {}) },
    loading: (current.loading ?? false) || (next.loading ?? false),
    probeGraphite: (current.probeGraphite ?? false) || (next.probeGraphite ?? false),
  }
}

export const createOpenCodeGitGudHostAdapter = ({ api }: { api: Api }): OpenCodeGitGudHostAdapter => {
  return {
    branch: () => api.state.vcs?.branch,
    toast: ({ variant, message }) => api.ui.toast({ variant, message }),
    confirm(input) {
      api.ui.dialog.replace(() => <api.ui.DialogConfirm {...input} />)
    },
    promptText(input) {
      api.ui.dialog.replace(() => (
        <api.ui.DialogPrompt
          title={input.title}
          placeholder={input.placeholder}
          value={input.initial}
          busy={input.busy}
          busyText={input.busyText}
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
      if (session.error) {
        throw new Error(
          responseErrorMessage({ err: session.error, fallback: "Failed to create commit message session" }),
        )
      }
      sessionID = session.data.id
      const response = await api.client.session
        .prompt({
          sessionID,
          agent: input.agent,
          model: input.model,
          system: input.system,
          parts: [{ type: "text", text: input.prompt }],
        })
        .finally(() => {
          void api.client.session.delete({ sessionID }).then(
            () => undefined,
            () => undefined,
          )
        })
      if (response.error) {
        throw new Error(responseErrorMessage({ err: response.error, fallback: "Failed to generate commit message" }))
      }
      return response.data.parts
    },
    async install({ runtime, options, commands, slot }) {
      let replacedSidebarFiles = false
      if (options.replaceSidebarFiles) {
        const item = api.plugins.list().find((entry) => entry.id === "internal:sidebar-files")
        if (item?.enabled && item.active) {
          replacedSidebarFiles = await api.plugins.deactivate("internal:sidebar-files")
        }
      }

      let timer: ReturnType<typeof setTimeout> | undefined
      let scheduledRefresh: Partial<GitGudRefreshInput> | undefined
      const scheduleRefresh = (input: Partial<GitGudRefreshInput>) => {
        scheduledRefresh = mergeRefreshInput(scheduledRefresh, input)
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          const request = scheduledRefresh
          scheduledRefresh = undefined
          timer = undefined
          void runtime.refresh(request)
        }, 150)
      }

      const unwatchFile = api.event.on("file.watcher.updated", () =>
        scheduleRefresh({ loading: false, probeGraphite: false }),
      )
      const unwatchVcs = api.event.on("vcs.branch.updated", () =>
        scheduleRefresh({ loading: true, probeGraphite: true }),
      )

      api.command.register(commands)
      api.slots.register(slot)
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
