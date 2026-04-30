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
export type GitActionKeybindName =
  | "gitgud.open_status"
  | "gitgud.stage_all"
  | "gitgud.unstage_all"
  | "gitgud.generate_commit_message"
  | "gitgud.commit"
  | "gitgud.push"
  | "gitgud.refresh"

export type GitActionCatalogItem = {
  value: GitActionValue
  commandTitle: string
  dialogTitle?: string
  category: "Git"
  keybindName: GitActionKeybindName
  enabled: (state: GitState) => boolean
}

export const defaultGitGudKeybinds = {
  "gitgud.open_status": "<leader>v",
  "gitgud.stage_all": "<leader>A",
  "gitgud.unstage_all": "<leader>U",
  "gitgud.generate_commit_message": "<leader>p",
  "gitgud.commit": "<leader>C",
  "gitgud.push": "<leader>P",
  "gitgud.refresh": "f5",
} satisfies Record<GitActionKeybindName, string>

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
    keybindName: "gitgud.open_status",
    enabled: (state) => !state.busy,
  },
  {
    value: "stage-all",
    commandTitle: "GitGud: Stage all",
    dialogTitle: "Stage all changes",
    category: "Git",
    keybindName: "gitgud.stage_all",
    enabled: (state) => hasUnstaged(state) && !state.busy,
  },
  {
    value: "unstage-all",
    commandTitle: "GitGud: Unstage all",
    dialogTitle: "Unstage all changes",
    category: "Git",
    keybindName: "gitgud.unstage_all",
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "generate-commit-message",
    commandTitle: "GitGud: Generate commit message",
    dialogTitle: "Generate commit message",
    category: "Git",
    keybindName: "gitgud.generate_commit_message",
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "commit",
    commandTitle: "GitGud: Commit",
    dialogTitle: "Commit staged changes",
    category: "Git",
    keybindName: "gitgud.commit",
    enabled: (state) => state.files.length > 0 && !state.busy,
  },
  {
    value: "push",
    commandTitle: "GitGud: Push",
    dialogTitle: "Push current branch",
    category: "Git",
    keybindName: "gitgud.push",
    enabled: (state) => !state.busy,
  },
  {
    value: "refresh",
    commandTitle: "GitGud: Refresh",
    category: "Git",
    keybindName: "gitgud.refresh",
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
