/** @jsxImportSource @opentui/solid */
import { StyledText, type TextChunk } from "@opentui/core"
import { createMemo } from "solid-js"
import type { JSX } from "solid-js"
import { gitDialogActionOptions, parseGitDialogActionValue, type GitDialogActionValue } from "./action-catalog"
import type { GitFile, GitFileTone } from "./change-set"
import type { Api, GitGudActions, GitState } from "./types"

type FileOptionValue = `file:${string}`
type OptionValue = `action:${string}` | FileOptionValue
type Theme = Api["theme"]["current"]
type ThemeColor = Theme["text"]

type FileOption = {
  title: string
  value: FileOptionValue
  description?: string
  fg: ThemeColor
  footer: JSX.Element
  category: "Files"
  gutter: JSX.Element
}

const fileOptionValue = (path: string): FileOptionValue => `file:${path}`

const toneColor = (theme: Theme, tone: GitFileTone) => {
  if (tone === "success") return theme.success
  if (tone === "warning") return theme.warning
  if (tone === "muted") return theme.textMuted
  return theme.text
}

const chunk = (text: string, fg: ThemeColor): TextChunk => ({ __isChunk: true, text, fg })

const fileFooter = (file: GitFile, theme: Theme) => {
  const chunks = [
    ...(file.additions ? [chunk(` +${file.additions}`, theme.diffAdded)] : []),
    ...(file.deletions ? [chunk(` -${file.deletions}`, theme.diffRemoved)] : []),
  ]
  return chunks.length ? new StyledText(chunks) : ""
}

const FileStatus = (props: { api: Api; path: string; state: () => GitState }) => {
  const theme = createMemo(() => props.api.theme.current)
  const file = createMemo(() => props.state().files.find((item) => item.path === props.path))

  return <text fg={toneColor(theme(), file()?.statusTone ?? "muted")}>{file()?.statusLabel ?? "··"}</text>
}

const FileFooter = (props: { api: Api; path: string; state: () => GitState }) => {
  const theme = createMemo(() => props.api.theme.current)
  const file = createMemo(() => props.state().files.find((item) => item.path === props.path))
  const footer = createMemo(() => {
    const item = file()
    return item ? fileFooter(item, theme()) : ""
  })

  return <>{footer()}</>
}

export const GitStatusDialog = (props: { api: Api; state: () => GitState; actions: GitGudActions }) => {
  const fileOptionCache = new Map<string, FileOption>()

  const fileOption = (file: GitFile) => {
    const fg = toneColor(props.api.theme.current, file.titleTone)
    const cached = fileOptionCache.get(file.path)
    if (cached && cached.title === file.title && cached.description === file.description && cached.fg === fg)
      return cached

    const option: FileOption = {
      title: file.title,
      value: fileOptionValue(file.path),
      description: file.description,
      fg,
      footer: <FileFooter api={props.api} path={file.path} state={props.state} />,
      category: "Files",
      gutter: <FileStatus api={props.api} path={file.path} state={props.state} />,
    }
    fileOptionCache.set(file.path, option)
    return option
  }

  const options = createMemo(() => {
    const paths = new Set(props.state().files.map((file) => file.path))
    for (const path of fileOptionCache.keys()) {
      if (!paths.has(path)) fileOptionCache.delete(path)
    }
    return [...gitDialogActionOptions(props.state()), ...props.state().files.map(fileOption)]
  })

  const selectAction = (action: GitDialogActionValue) => {
    if (action === "stage-all") return void props.actions.stageAll()
    if (action === "unstage-all") return void props.actions.unstageAll()
    if (action === "generate-commit-message") return void props.actions.generateMessage()
    if (action === "commit") return props.actions.showCommit()
    if (action === "push") return void props.actions.push()
  }

  const selectFile = (path: string) => {
    const file = props.state().files.find((item) => item.path === path)
    if (!file) return
    if (file.unstaged || file.untracked) {
      void props.actions.stageFile(file)
      return
    }
    if (file.staged) {
      void props.actions.unstageFile(file)
    }
  }

  return (
    <props.api.ui.DialogSelect<OptionValue>
      title="Git Status"
      placeholder="Search changed files"
      options={options()}
      onSelect={(option) => {
        if (props.state().busy || option.disabled) return
        const action = parseGitDialogActionValue(option.value)
        if (action) {
          selectAction(action)
          return
        }
        selectFile(option.value.slice("file:".length))
      }}
    />
  )
}
