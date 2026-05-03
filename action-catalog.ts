import type { GitState } from "./types"

export type GitActionValue = "open-status" | "stage-all" | "unstage-all" | "commit" | "push" | "refresh"

export type GitDialogActionValue = Exclude<GitActionValue, "open-status" | "refresh">
export type GitDialogActionOptionValue = `action:${GitDialogActionValue}`
type GitCommandOnlyActionValue = Exclude<GitActionValue, GitDialogActionValue>
export type GitActionKeybindName =
  | "gitgud.open_status"
  | "gitgud.stage_all"
  | "gitgud.unstage_all"
  | "gitgud.commit"
  | "gitgud.push"
  | "gitgud.refresh"

type GitActionCatalogDialog =
  | Readonly<{ kind: "none" }>
  | Readonly<{
      kind: "select"
      title: string
    }>

type GitActionCatalogBase<TActionValue extends GitActionValue> = Readonly<{
  value: TActionValue
  commandTitle: string
  category: "Git"
  keybindName: GitActionKeybindName
  enabled: (state: GitState) => boolean
}>

type GitCommandOnlyActionCatalogItem = GitActionCatalogBase<GitCommandOnlyActionValue> &
  Readonly<{
    dialog: Extract<GitActionCatalogDialog, { kind: "none" }>
  }>

type GitDialogActionCatalogItem = GitActionCatalogBase<GitDialogActionValue> &
  Readonly<{
    dialog: Extract<GitActionCatalogDialog, { kind: "select" }>
  }>

export type GitActionCatalogItem = GitCommandOnlyActionCatalogItem | GitDialogActionCatalogItem

export const defaultGitGudKeybinds = {
  "gitgud.open_status": "<leader>v",
  "gitgud.stage_all": "<leader>A",
  "gitgud.unstage_all": "<leader>U",
  "gitgud.commit": "<leader>C",
  "gitgud.push": "<leader>P",
  "gitgud.refresh": "f5",
} as const satisfies Record<GitActionKeybindName, string>

const hasStaged = (state: GitState) => state.files.some((file) => file.staged)
const hasUnstaged = (state: GitState) => state.files.some((file) => file.unstaged || file.untracked)

export const isGitDialogActionCatalogItem = (item: GitActionCatalogItem): item is GitDialogActionCatalogItem => {
  return item.dialog.kind === "select"
}

const dialogActionValue = ({ item }: { item: GitActionCatalogItem }): GitDialogActionValue | undefined => {
  if (!isGitDialogActionCatalogItem(item)) return
  return item.value
}

export const gitActionCatalog: ReadonlyArray<GitActionCatalogItem> = [
  {
    value: "open-status",
    commandTitle: "GitGud: Open Git Status",
    dialog: { kind: "none" },
    category: "Git",
    keybindName: "gitgud.open_status",
    enabled: (state) => !state.busy,
  },
  {
    value: "stage-all",
    commandTitle: "GitGud: Stage all",
    dialog: { kind: "select", title: "Stage all changes" },
    category: "Git",
    keybindName: "gitgud.stage_all",
    enabled: (state) => hasUnstaged(state) && !state.busy,
  },
  {
    value: "unstage-all",
    commandTitle: "GitGud: Unstage all",
    dialog: { kind: "select", title: "Unstage all changes" },
    category: "Git",
    keybindName: "gitgud.unstage_all",
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "commit",
    commandTitle: "GitGud: Commit",
    dialog: { kind: "select", title: "Commit staged changes" },
    category: "Git",
    keybindName: "gitgud.commit",
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "push",
    commandTitle: "GitGud: Push",
    dialog: { kind: "select", title: "Push current branch" },
    category: "Git",
    keybindName: "gitgud.push",
    enabled: (state) => state.unpushedCommits > 0 && !state.busy,
  },
  {
    value: "refresh",
    commandTitle: "GitGud: Refresh",
    dialog: { kind: "none" },
    category: "Git",
    keybindName: "gitgud.refresh",
    enabled: (state) => !state.busy,
  },
]

export const gitCommandValue = (value: GitActionValue) => `gitgud.${value}`

export const gitDialogActionOptionValue = (value: GitDialogActionValue): GitDialogActionOptionValue => {
  return `action:${value}`
}

export const gitDialogActionOptions = ({ state }: { state: GitState }) => {
  return gitActionCatalog.flatMap((item) => {
    const value = dialogActionValue({ item })
    if (!value || item.dialog.kind === "none") return []
    return [
      {
        title: item.dialog.title,
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
