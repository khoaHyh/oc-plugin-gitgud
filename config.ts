import { defaultGitGudKeybinds, type GitActionKeybindName } from "./action-catalog"

export type GitGudConfig = Readonly<{
  enabled: boolean
  workflow: GitGudWorkflowConfig
  replaceSidebarFiles: boolean
  confirmPush: boolean
  confirmStageAllOnCommit: boolean
  commitAgent: string | undefined
  commitModel: GitGudCommitModel | undefined
  commitSystemInstructions: string
  keybinds: Readonly<Partial<Record<GitActionKeybindName, string>>>
}>

export type GitGudWorkflowConfig = "auto" | "git" | "graphite"

export type GitGudCommitModel = Readonly<{
  providerID: string
  modelID: string
}>

export const defaultConfig = {
  enabled: true,
  workflow: "auto",
  replaceSidebarFiles: false,
  confirmPush: true,
  confirmStageAllOnCommit: true,
  commitAgent: undefined,
  commitModel: undefined,
  commitSystemInstructions: "",
  keybinds: defaultGitGudKeybinds,
} as const satisfies GitGudConfig

const keybindConfigEntries: ReadonlyArray<Readonly<{ key: string; name: GitActionKeybindName }>> = [
  { key: "open_status", name: "gitgud.open_status" },
  { key: "stage_all", name: "gitgud.stage_all" },
  { key: "unstage_all", name: "gitgud.unstage_all" },
  { key: "commit", name: "gitgud.commit" },
  { key: "push", name: "gitgud.push" },
  { key: "graphite_create", name: "gitgud.graphite_create" },
  { key: "graphite_modify", name: "gitgud.graphite_modify" },
  { key: "graphite_submit_stack", name: "gitgud.graphite_submit_stack" },
  { key: "graphite_sync", name: "gitgud.graphite_sync" },
  { key: "graphite_up", name: "gitgud.graphite_up" },
  { key: "graphite_down", name: "gitgud.graphite_down" },
  { key: "refresh", name: "gitgud.refresh" },
]

const rec = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  return Object.fromEntries(Object.entries(value))
}

const optionalString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const optionalNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  if (!trimmed) return
  return trimmed
}

const model = (value: unknown): GitGudCommitModel | undefined => {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  const index = trimmed.indexOf("/")
  if (index <= 0 || index === trimmed.length - 1) return
  const providerID = trimmed.slice(0, index).trim()
  const modelID = trimmed.slice(index + 1).trim()
  if (!providerID || !modelID) return
  return { providerID, modelID }
}

const bool = (value: unknown, fallback: boolean) => {
  if (typeof value !== "boolean") return fallback
  return value
}

const workflow = (value: unknown): GitGudWorkflowConfig => {
  if (value === "git" || value === "graphite" || value === "auto") return value
  return defaultConfig.workflow
}

const normalizeKeybinds = (value: unknown) => {
  const opts = rec(value)
  if (!opts) return defaultConfig.keybinds

  const keybinds: Partial<Record<GitActionKeybindName, string>> = { ...defaultConfig.keybinds }
  for (const { key, name } of keybindConfigEntries) {
    if (!Object.hasOwn(opts, key)) continue
    const raw = opts[key]
    if (raw === false || raw === null || raw === undefined) {
      keybinds[name] = "none"
    } else if (typeof raw === "string") {
      keybinds[name] = raw.trim() || "none"
    }
  }
  return keybinds
}

export const normalizeConfig = (options: unknown): GitGudConfig => {
  const opts = rec(options)
  return {
    enabled: bool(opts?.enabled, defaultConfig.enabled),
    workflow: workflow(opts?.workflow),
    replaceSidebarFiles: bool(opts?.replace_sidebar_files, defaultConfig.replaceSidebarFiles),
    confirmPush: bool(opts?.confirm_push, defaultConfig.confirmPush),
    confirmStageAllOnCommit: bool(opts?.confirm_stage_all_on_commit, defaultConfig.confirmStageAllOnCommit),
    commitAgent: optionalNonEmptyString(opts?.commit_agent),
    commitModel: model(opts?.commit_model),
    commitSystemInstructions: optionalString(opts?.commit_system_instructions),
    keybinds: normalizeKeybinds(opts?.keybinds),
  }
}
