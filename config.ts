import { defaultGitGudKeybinds, type GitActionKeybindName } from "./action-catalog"

export type GitGudConfig = {
  enabled: boolean
  replaceSidebarFiles: boolean
  confirmPush: boolean
  confirmStageAllOnCommit: boolean
  commitAgent: string
  commitModel?: GitGudCommitModel
  commitSystemInstructions: string
  keybinds: Partial<Record<GitActionKeybindName, string>>
}

export type GitGudCommitModel = {
  providerID: string
  modelID: string
}

export const defaultConfig = {
  enabled: true,
  replaceSidebarFiles: false,
  confirmPush: true,
  confirmStageAllOnCommit: true,
  commitAgent: "build",
  commitModel: undefined,
  commitSystemInstructions: "",
  keybinds: defaultGitGudKeybinds,
} satisfies GitGudConfig

const keybindConfigKeys = {
  open_status: "gitgud.open_status",
  stage_all: "gitgud.stage_all",
  unstage_all: "gitgud.unstage_all",
  commit: "gitgud.commit",
  push: "gitgud.push",
  refresh: "gitgud.refresh",
} satisfies Record<string, GitActionKeybindName>

const rec = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  return Object.fromEntries(Object.entries(value))
}

const pick = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback
  if (!value.trim()) return fallback
  return value
}

const optionalString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
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

const normalizeKeybinds = (value: unknown) => {
  const opts = rec(value)
  if (!opts) return defaultConfig.keybinds

  const keybinds = { ...defaultConfig.keybinds }
  for (const [key, name] of Object.entries(keybindConfigKeys) as [string, GitActionKeybindName][]) {
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
    replaceSidebarFiles: bool(opts?.replace_sidebar_files, defaultConfig.replaceSidebarFiles),
    confirmPush: bool(opts?.confirm_push, defaultConfig.confirmPush),
    confirmStageAllOnCommit: bool(opts?.confirm_stage_all_on_commit, defaultConfig.confirmStageAllOnCommit),
    commitAgent: pick(opts?.commit_agent, defaultConfig.commitAgent),
    commitModel: model(opts?.commit_model),
    commitSystemInstructions: optionalString(opts?.commit_system_instructions),
    keybinds: normalizeKeybinds(opts?.keybinds),
  }
}
