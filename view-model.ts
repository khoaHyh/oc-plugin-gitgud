import {
  gitActionCatalog,
  gitCommandValue,
  gitDialogActionOptionValue,
  type GitActionValue,
  type GitDialogActionOptionValue,
  type GitDialogActionValue,
} from "./action-catalog"
import type { GitFile, GitFileTone } from "./change-set"
import type { GitState } from "./types"

export type GitGudSidebarButton = {
  label: string
  action: GitActionValue
  disabled: boolean
}

export type GitGudSidebarViewModel = {
  title: string
  summary: string
  error?: string
  hasFiles: boolean
  buttons: GitGudSidebarButton[]
}

export type GitGudCommandViewModel = {
  title: string
  value: string
  category: "Git"
  keybindName: string
  enabled: boolean
  action: GitActionValue
}

export type GitStatusActionOptionViewModel = {
  kind: "action"
  title: string
  value: GitDialogActionOptionValue
  category: "Actions"
  disabled: boolean
  action: GitDialogActionValue
}

export type GitStatusFileOptionViewModel = {
  kind: "file"
  path: string
  title: string
  value: `file:${string}`
  description?: string
  category: "Files"
  titleTone: GitFileTone
  statusTone: GitFileTone
  statusLabel: string
  additions: number
  deletions: number
}

export type GitStatusOptionViewModel = GitStatusActionOptionViewModel | GitStatusFileOptionViewModel

export type GitStatusDialogViewModel = {
  title: string
  placeholder: string
  busy: boolean
  options: GitStatusOptionViewModel[]
}

const hasStaged = (files: readonly GitFile[]) => files.some((file) => file.staged)

export const gitStatusFileOptionValue = (path: string): `file:${string}` => `file:${path}`

export const createSidebarViewModel = (state: GitState): GitGudSidebarViewModel => {
  const staged = state.files.filter((file) => file.staged)
  const unstaged = state.files.filter((file) => file.unstaged || file.untracked)

  return {
    title: "GitGud",
    summary: `${unstaged.length} unstaged · ${staged.length} staged`,
    error: state.error,
    hasFiles: state.files.length > 0,
    buttons: [
      { label: "open", action: "open-status", disabled: state.busy },
      { label: "msg", action: "generate-commit-message", disabled: state.busy || !hasStaged(state.files) },
      { label: "commit", action: "commit", disabled: state.busy },
      { label: "push", action: "push", disabled: state.busy },
    ],
  }
}

export const createCommandViewModel = (state: GitState): GitGudCommandViewModel[] => {
  return gitActionCatalog.map((item) => ({
    title: item.commandTitle,
    value: gitCommandValue(item.value),
    category: item.category,
    keybindName: item.keybindName,
    enabled: item.enabled(state),
    action: item.value,
  }))
}

export const createGitStatusDialogViewModel = (state: GitState): GitStatusDialogViewModel => {
  return {
    title: "Git Status",
    placeholder: "Search changed files",
    busy: state.busy,
    options: [
      ...gitActionCatalog.flatMap<GitStatusActionOptionViewModel>((item) => {
        if (!item.dialogTitle) return []
        if (item.value === "open-status" || item.value === "refresh") return []
        return [
          {
            kind: "action",
            title: item.dialogTitle,
            value: gitDialogActionOptionValue(item.value),
            category: "Actions",
            disabled: !item.enabled(state),
            action: item.value,
          },
        ]
      }),
      ...state.files.map<GitStatusFileOptionViewModel>((file) => ({
        kind: "file",
        path: file.path,
        title: file.title,
        value: gitStatusFileOptionValue(file.path),
        description: file.description,
        category: "Files",
        titleTone: file.titleTone,
        statusTone: file.statusTone,
        statusLabel: file.statusLabel,
        additions: file.additions,
        deletions: file.deletions,
      })),
    ],
  }
}
