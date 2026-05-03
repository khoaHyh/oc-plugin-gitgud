/** @jsxImportSource @opentui/solid */
import { StyledText, type TextChunk } from "@opentui/core"
import { createMemo, type Accessor } from "solid-js"
import type { JSX } from "solid-js"
import type { GitFileTone } from "./change-set"
import type { GitGudRuntime } from "./runtime"
import type { Api } from "./types"
import type { GitStatusFileOptionViewModel, GitStatusOptionViewModel } from "./view-model"

type FileOptionValue = `file:${string}`
type OptionValue = `action:${string}` | FileOptionValue
type Theme = Api["theme"]["current"]
type ThemeColor = Theme["text"]

type FileOption = Readonly<{
  title: string
  value: FileOptionValue
  description: string | undefined
  fg: ThemeColor
  footer: JSX.Element
  category: "Files"
  gutter: () => JSX.Element
}>

const toneColor = ({ theme, tone }: { theme: Theme; tone: GitFileTone }) => {
  if (tone === "success") return theme.success
  if (tone === "warning") return theme.warning
  if (tone === "muted") return theme.textMuted
  return theme.text
}

const chunk = ({ text, fg }: { text: string; fg: ThemeColor }): TextChunk => ({ __isChunk: true, text, fg })

const fileFooter = ({ file, theme }: { file: GitStatusFileOptionViewModel; theme: Theme }) => {
  const chunks = [
    ...(file.additions ? [chunk({ text: ` +${file.additions}`, fg: theme.diffAdded })] : []),
    ...(file.deletions ? [chunk({ text: ` -${file.deletions}`, fg: theme.diffRemoved })] : []),
  ]
  return chunks.length ? new StyledText(chunks) : ""
}

const FileStatus = (props: { api: Api; file: Accessor<GitStatusFileOptionViewModel | undefined> }) => {
  const theme = createMemo(() => props.api.theme.current)
  return (
    <text fg={toneColor({ theme: theme(), tone: props.file()?.statusTone ?? "muted" })}>
      {props.file()?.statusLabel ?? "··"}
    </text>
  )
}

const FileFooter = (props: { api: Api; file: Accessor<GitStatusFileOptionViewModel | undefined> }) => {
  const theme = createMemo(() => props.api.theme.current)
  const footer = createMemo(() => {
    const item = props.file()
    return item ? fileFooter({ file: item, theme: theme() }) : ""
  })

  return <>{footer()}</>
}

export const GitStatusDialog = (props: { api: Api; runtime: GitGudRuntime }) => {
  const fileOptionCache = new Map<string, FileOption>()

  const fileMap = createMemo(() => {
    const view = props.runtime.view.statusDialog()
    const map = new Map<string, GitStatusFileOptionViewModel>()
    for (const item of view.options) {
      if (item.kind === "file") map.set(item.path, item)
    }
    return map
  })

  const fileOption = (file: GitStatusFileOptionViewModel) => {
    const fg = toneColor({ theme: props.api.theme.current, tone: file.titleTone })
    const cached = fileOptionCache.get(file.path)
    if (cached && cached.title === file.title && cached.description === file.description && cached.fg === fg)
      return cached

    const option: FileOption = {
      title: file.title,
      value: file.value,
      description: file.description,
      fg,
      footer: <FileFooter api={props.api} file={() => fileMap().get(file.path)} />,
      category: "Files",
      gutter: () => <FileStatus api={props.api} file={() => fileMap().get(file.path)} />,
    }
    fileOptionCache.set(file.path, option)
    return option
  }

  const options = createMemo(() => {
    const view = props.runtime.view.statusDialog()
    const paths = new Set(
      view.options.flatMap((item) => {
        if (item.kind !== "file") return []
        return [item.path]
      }),
    )
    for (const path of fileOptionCache.keys()) {
      if (!paths.has(path)) fileOptionCache.delete(path)
    }
    return view.options.map((item): GitStatusOptionViewModel | FileOption => {
      if (item.kind === "file") return fileOption(item)
      return item
    })
  })

  return (
    <props.api.ui.DialogSelect<OptionValue>
      title={props.runtime.view.statusDialog().title}
      placeholder={props.runtime.view.statusDialog().placeholder}
      options={options()}
      onSelect={(option) => {
        if (props.runtime.view.statusDialog().busy || option.disabled) return
        const viewOption = props.runtime.view.statusDialog().options.find((item) => item.value === option.value)
        if (!viewOption) return
        if (viewOption.kind === "action") {
          props.runtime.runDialogAction(viewOption.action)
          return
        }
        props.runtime.selectStatusFile(viewOption.path)
      }}
    />
  )
}
