import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import type { GitFile } from "./change-set"

export type Api = Parameters<TuiPlugin>[0]

export type GitState = Readonly<{
  loading: boolean
  busy: boolean
  workflow: GitGudWorkflow
  graphite: GitGudGraphiteState
  message: string
  files: ReadonlyArray<GitFile>
  unpushedCommits: number
  branch: string | undefined
  error: string | undefined
}>

export type GitGudWorkflow = "git" | "graphite"

export type GitGudGraphiteState = Readonly<{
  available: boolean
  summary: string | undefined
}>

export type GitGudRefreshInput = Readonly<{
  patch: Partial<GitState>
  loading: boolean
}>

export type GitGudActions = Readonly<{
  refresh: (input?: Partial<GitGudRefreshInput>) => Promise<void>
  stageFile: (file: GitFile) => Promise<boolean>
  stageAll: () => Promise<boolean>
  unstageFile: (file: GitFile) => Promise<boolean>
  unstageAll: () => Promise<boolean>
  generateMessage: () => Promise<void>
  showCommit: (initial?: string) => void
  push: () => Promise<void>
  showStatus: () => void
}>

export type ToastVariant = "info" | "success" | "warning" | "error"
