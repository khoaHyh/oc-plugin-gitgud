import type { GitState } from "./types"

export type GitActionValue =
  | "open-status"
  | "stage-all"
  | "unstage-all"
  | "commit"
  | "push"
  | "graphite-create"
  | "graphite-modify"
  | "graphite-submit-stack"
  | "graphite-sync"
  | "graphite-up"
  | "graphite-down"
  | "refresh"

export type GitDialogActionValue = Exclude<GitActionValue, "open-status" | "refresh">
export type GitDialogActionOptionValue = `action:${GitDialogActionValue}`
type GitCommandOnlyActionValue = Exclude<GitActionValue, GitDialogActionValue>
export type GitActionKeybindName =
  | "gitgud.open_status"
  | "gitgud.stage_all"
  | "gitgud.unstage_all"
  | "gitgud.commit"
  | "gitgud.push"
  | "gitgud.graphite_create"
  | "gitgud.graphite_modify"
  | "gitgud.graphite_submit_stack"
  | "gitgud.graphite_sync"
  | "gitgud.graphite_up"
  | "gitgud.graphite_down"
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
  visible: (state: GitState) => boolean
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
  "gitgud.graphite_create": "none",
  "gitgud.graphite_modify": "none",
  "gitgud.graphite_submit_stack": "none",
  "gitgud.graphite_sync": "none",
  "gitgud.graphite_up": "none",
  "gitgud.graphite_down": "none",
  "gitgud.refresh": "f5",
} as const satisfies Record<GitActionKeybindName, string>

const hasStaged = (state: GitState) => state.files.some((file) => file.staged)
const hasUnstaged = (state: GitState) => state.files.some((file) => file.unstaged || file.untracked)
const hasChanged = (state: GitState) => state.files.length > 0
const isGitWorkflow = (state: GitState) => state.workflow === "git"
const isGraphiteWorkflow = (state: GitState) => state.workflow === "graphite"

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
    visible: () => true,
    enabled: (state) => !state.busy,
  },
  {
    value: "stage-all",
    commandTitle: "GitGud: Stage all",
    dialog: { kind: "select", title: "Stage all changes" },
    category: "Git",
    keybindName: "gitgud.stage_all",
    visible: () => true,
    enabled: (state) => hasUnstaged(state) && !state.busy,
  },
  {
    value: "unstage-all",
    commandTitle: "GitGud: Unstage all",
    dialog: { kind: "select", title: "Unstage all changes" },
    category: "Git",
    keybindName: "gitgud.unstage_all",
    visible: () => true,
    enabled: (state) => hasStaged(state) && !state.busy,
  },
  {
    value: "commit",
    commandTitle: "GitGud: Commit",
    dialog: { kind: "select", title: "Commit changes" },
    category: "Git",
    keybindName: "gitgud.commit",
    visible: isGitWorkflow,
    enabled: (state) => isGitWorkflow(state) && hasChanged(state) && !state.busy,
  },
  {
    value: "push",
    commandTitle: "GitGud: Push",
    dialog: { kind: "select", title: "Push current branch" },
    category: "Git",
    keybindName: "gitgud.push",
    visible: isGitWorkflow,
    enabled: (state) => isGitWorkflow(state) && state.unpushedCommits > 0 && !state.busy,
  },
  {
    value: "graphite-create",
    commandTitle: "GitGud: Create Graphite branch",
    dialog: { kind: "select", title: "Create Graphite branch" },
    category: "Git",
    keybindName: "gitgud.graphite_create",
    visible: isGraphiteWorkflow,
    enabled: (state) => isGraphiteWorkflow(state) && state.graphite.available && !hasStaged(state) && !state.busy,
  },
  {
    value: "graphite-modify",
    commandTitle: "GitGud: Modify current diff",
    dialog: { kind: "select", title: "Modify current diff" },
    category: "Git",
    keybindName: "gitgud.graphite_modify",
    visible: isGraphiteWorkflow,
    enabled: (state) => isGraphiteWorkflow(state) && state.graphite.available && hasChanged(state) && !state.busy,
  },
  {
    value: "graphite-submit-stack",
    commandTitle: "GitGud: Submit stack",
    dialog: { kind: "select", title: "Submit stack" },
    category: "Git",
    keybindName: "gitgud.graphite_submit_stack",
    visible: isGraphiteWorkflow,
    enabled: (state) => isGraphiteWorkflow(state) && state.graphite.available && !state.busy,
  },
  {
    value: "graphite-sync",
    commandTitle: "GitGud: Sync stack",
    dialog: { kind: "select", title: "Sync stack" },
    category: "Git",
    keybindName: "gitgud.graphite_sync",
    visible: isGraphiteWorkflow,
    enabled: (state) => isGraphiteWorkflow(state) && state.graphite.available && !state.busy,
  },
  {
    value: "graphite-up",
    commandTitle: "GitGud: Move up stack",
    dialog: { kind: "select", title: "Move up stack" },
    category: "Git",
    keybindName: "gitgud.graphite_up",
    visible: isGraphiteWorkflow,
    enabled: (state) => isGraphiteWorkflow(state) && state.graphite.available && !state.busy,
  },
  {
    value: "graphite-down",
    commandTitle: "GitGud: Move down stack",
    dialog: { kind: "select", title: "Move down stack" },
    category: "Git",
    keybindName: "gitgud.graphite_down",
    visible: isGraphiteWorkflow,
    enabled: (state) => isGraphiteWorkflow(state) && state.graphite.available && !state.busy,
  },
  {
    value: "refresh",
    commandTitle: "GitGud: Refresh",
    dialog: { kind: "none" },
    category: "Git",
    keybindName: "gitgud.refresh",
    visible: () => true,
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
    if (!value || item.dialog.kind === "none" || !item.visible(state)) return []
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
