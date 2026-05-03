import {
  gitActionCatalog,
  gitCommandValue,
  gitDialogActionOptionValue,
  isGitDialogActionCatalogItem,
  type GitActionValue,
  type GitDialogActionOptionValue,
  type GitDialogActionValue,
} from "./action-catalog"
import type { GitFile, GitFileTone } from "./change-set"
import type { GitState } from "./types"

export type GitGudSidebarButton = Readonly<{
  label: string
  action: GitActionValue
  disabled: boolean
}>

export type GitGudSidebarViewModel = Readonly<{
  title: string
  summary: string
  error: string | undefined
  hasFiles: boolean
  buttons: ReadonlyArray<GitGudSidebarButton>
}>

export type GitGudCommandViewModel = Readonly<{
  title: string
  value: string
  category: "Git"
  keybindName: string
  enabled: boolean
  action: GitActionValue
}>

export type GitStatusActionOptionViewModel = Readonly<{
  kind: "action"
  title: string
  value: GitDialogActionOptionValue
  category: "Actions"
  disabled: boolean
  action: GitDialogActionValue
}>

export type GitStatusFileOptionViewModel = Readonly<{
  kind: "file"
  path: string
  title: string
  value: `file:${string}`
  description: string | undefined
  category: "Files"
  titleTone: GitFileTone
  statusTone: GitFileTone
  statusLabel: string
  additions: number
  deletions: number
}>

export type GitStatusOptionViewModel = GitStatusActionOptionViewModel | GitStatusFileOptionViewModel

export type GitStatusDialogViewModel = Readonly<{
  title: string
  placeholder: string
  busy: boolean
  options: ReadonlyArray<GitStatusOptionViewModel>
}>

const hasStaged = (files: readonly GitFile[]) => files.some((file) => file.staged)

const createStageButton = ({
  stagedCount,
  unstagedCount,
  busy,
}: {
  stagedCount: number
  unstagedCount: number
  busy: boolean
}): GitGudSidebarButton => {
  if (stagedCount > 0 && unstagedCount === 0) {
    return { label: "unstage", action: "unstage-all", disabled: busy }
  }

  return { label: "stage", action: "stage-all", disabled: busy || unstagedCount === 0 }
}

export const gitStatusFileOptionValue = (path: string): `file:${string}` => `file:${path}`

export const createSidebarViewModel = ({ state }: { state: GitState }): GitGudSidebarViewModel => {
  const staged = state.files.filter((file) => file.staged)
  const unstaged = state.files.filter((file) => file.unstaged || file.untracked)

  return {
    title: "GitGud",
    summary: `${unstaged.length} unstaged · ${staged.length} staged`,
    error: state.error,
    hasFiles: state.files.length > 0,
    buttons: [
      { label: "open", action: "open-status", disabled: state.busy },
      createStageButton({ stagedCount: staged.length, unstagedCount: unstaged.length, busy: state.busy }),
      { label: "commit", action: "commit", disabled: state.busy || !hasStaged(state.files) },
      { label: "push", action: "push", disabled: state.busy || state.unpushedCommits === 0 },
    ],
  }
}

export const createCommandViewModel = ({ state }: { state: GitState }): ReadonlyArray<GitGudCommandViewModel> => {
  return gitActionCatalog.map((item) => ({
    title: item.commandTitle,
    value: gitCommandValue(item.value),
    category: item.category,
    keybindName: item.keybindName,
    enabled: item.enabled(state),
    action: item.value,
  }))
}

export const createGitStatusDialogViewModel = ({ state }: { state: GitState }): GitStatusDialogViewModel => {
  return {
    title: "Git Status",
    placeholder: "Search changed files",
    busy: state.busy,
    options: [
      ...gitActionCatalog.flatMap<GitStatusActionOptionViewModel>((item) => {
        if (!isGitDialogActionCatalogItem(item)) return []
        return [
          {
            kind: "action",
            title: item.dialog.title,
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
