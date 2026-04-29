import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import type { GitFile } from "./change-set"

export type Api = Parameters<TuiPlugin>[0]

export type GitState = {
  loading: boolean
  busy: boolean
  message: string
  files: GitFile[]
  branch?: string
  error?: string
}

export type GitGudActions = {
  refresh: (patch?: Partial<GitState>, options?: { loading?: boolean }) => Promise<void>
  stageFile: (file: GitFile) => Promise<boolean>
  stageAll: () => Promise<boolean>
  unstageFile: (file: GitFile) => Promise<boolean>
  unstageAll: () => Promise<boolean>
  generateMessage: () => Promise<void>
  showCommit: (initial?: string) => void
  push: () => Promise<void>
  showStatus: () => void
}

export type ToastVariant = "info" | "success" | "warning" | "error"
