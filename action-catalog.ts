import type { GitState } from "./types"

export type GitActionValue =
  | "open-status"
  | "stage-all"
  | "unstage-all"
  | "generate-commit-message"
  | "commit"
  | "push"
  | "refresh"

export type GitDialogActionValue = Exclude<GitActionValue, "open-status" | "refresh">
export type GitDialogActionOptionValue = `action:${GitDialogActionValue}`

export type GitActionCatalogItem = {
  value: GitActionValue
  commandTitle: string
  dialogTitle?: string
  category: "Git"
  enabled: (state: GitState) => boolean
}

const hasStaged = (state: GitState) => state.files.some((file) => file.staged)
const hasUnstaged = (state: GitState) => state.files.some((file) => file.unstaged || file.untracked)

const dialogActionValue = (item: GitActionCatalogItem): GitDialogActionValue | undefined => {
  if (!item.dialogTitle) return
  if (item.value === "open-status" || item.value === "refresh") return
  return item.value
}

export const gitActionCatalog: GitActionCatalogItem[] = [
  {
    value: "open-status",
    commandTitle: "GitGud: Open Git Status",
    category: "Git",
    enabled: (state) => !state.busy,
  },
  {
    value: "stage-all",
    commandTitle: "GitGud: Stage all",
    dialogTitle: "Stage all changes",
    category: "Git",
    enabled: (state) => hasUnstaged(state) && !state.busy,
  },
  {
    value: "unstage-all",
    commandTitle: "GitGud: Unstage all",
    dialogTitle: "Unstage all changes",
    category: "Git",
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "generate-commit-message",
    commandTitle: "GitGud: Generate commit message",
    dialogTitle: "Generate commit message",
    category: "Git",
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "commit",
    commandTitle: "GitGud: Commit",
    dialogTitle: "Commit staged changes",
    category: "Git",
    enabled: (state) => state.files.length > 0 && !state.busy,
  },
  {
    value: "push",
    commandTitle: "GitGud: Push",
    dialogTitle: "Push current branch",
    category: "Git",
    enabled: (state) => !state.busy,
  },
  {
    value: "refresh",
    commandTitle: "GitGud: Refresh",
    category: "Git",
    enabled: (state) => !state.busy,
  },
]

export const gitCommandValue = (value: GitActionValue) => `gitgud.${value}`

export const gitDialogActionOptionValue = (value: GitDialogActionValue): GitDialogActionOptionValue => {
  return `action:${value}`
}

export const gitDialogActionOptions = (state: GitState) => {
  return gitActionCatalog.flatMap((item) => {
    const value = dialogActionValue(item)
    if (!value || !item.dialogTitle) return []
    return [
      {
        title: item.dialogTitle,
        value: gitDialogActionOptionValue(value),
        category: "Actions",
        disabled: !item.enabled(state),
      },
    ]
  })
}

export const isGitActionValue = (value: string): value is GitActionValue => {
  return gitActionCatalog.some((item) => item.value === value)
}

export const parseGitDialogActionValue = (value: string): GitDialogActionValue | undefined => {
  if (!value.startsWith("action:")) return
  const action = value.slice("action:".length)
  if (!isGitActionValue(action)) return
  if (action === "open-status" || action === "refresh") return
  return action
}
