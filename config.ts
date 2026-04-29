export type GitGudConfig = {
  enabled: boolean
  replaceSidebarFiles: boolean
  confirmPush: boolean
  confirmStageAllOnCommit: boolean
  commitAgent: string
}

export const defaultConfig = {
  enabled: true,
  replaceSidebarFiles: false,
  confirmPush: true,
  confirmStageAllOnCommit: true,
  commitAgent: "build",
} satisfies GitGudConfig

const rec = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  return Object.fromEntries(Object.entries(value))
}

const pick = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback
  if (!value.trim()) return fallback
  return value
}

const bool = (value: unknown, fallback: boolean) => {
  if (typeof value !== "boolean") return fallback
  return value
}

export const normalizeConfig = (options: unknown): GitGudConfig => {
  const opts = rec(options)
  return {
    enabled: bool(opts?.enabled, defaultConfig.enabled),
    replaceSidebarFiles: bool(opts?.replace_sidebar_files, defaultConfig.replaceSidebarFiles),
    confirmPush: bool(opts?.confirm_push, defaultConfig.confirmPush),
    confirmStageAllOnCommit: bool(opts?.confirm_stage_all_on_commit, defaultConfig.confirmStageAllOnCommit),
    commitAgent: pick(opts?.commit_agent, defaultConfig.commitAgent),
  }
}
