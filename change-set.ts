export type GitFileTone = "text" | "muted" | "success" | "warning"

export type GitFile = {
  path: string
  previousPath?: string
  title: string
  description?: string
  statusLabel: string
  titleTone: GitFileTone
  statusTone: GitFileTone
  staged: boolean
  unstaged: boolean
  untracked: boolean
  tracked: boolean
  additions: number
  deletions: number
}

type GitStat = {
  additions: number
  deletions: number
}

export const firstLine = (value: string) => {
  if (!value.includes("\n")) return value
  return value.slice(0, value.indexOf("\n"))
}

const statusChars = (code: string) => {
  if (code === "??") return ["?", "?"]
  return [code[0] || " ", code[1] || " "]
}

const statusLabel = (code: string) => {
  if (code === "??") return "??"
  return statusChars(code)
    .map((char) => (char === " " ? "·" : char))
    .join("")
}

const titleTone = (staged: boolean, unstaged: boolean): GitFileTone => {
  if (staged && !unstaged) return "success"
  if (staged && unstaged) return "warning"
  return "text"
}

const statusTone = ({
  untracked,
  staged,
  unstaged,
}: {
  untracked: boolean
  staged: boolean
  unstaged: boolean
}): GitFileTone => {
  if (untracked) return "warning"
  if (staged && !unstaged) return "success"
  if (staged && unstaged) return "warning"
  return "muted"
}

export const parseGitNumstat = (stdout: string) => {
  return new Map<string, GitStat>(
    stdout
      .split("\0")
      .filter(Boolean)
      .flatMap((line) => {
        const parts = line.split("\t")
        const additions = Number(parts[0])
        const deletions = Number(parts[1])
        const path = parts[2]
        if (!path || !Number.isFinite(additions) || !Number.isFinite(deletions)) return []
        return [[path, { additions, deletions }] as const]
      }),
  )
}

export const createGitChangeSet = (statusOutput: string, numstatOutput: string): GitFile[] => {
  const stats = parseGitNumstat(numstatOutput)
  const lines = statusOutput.split("\0")
  const files: GitFile[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.length < 3) continue

    const code = line.slice(0, 2)
    const path = line.slice(3)
    const previousPath = code[0] === "R" || code[0] === "C" ? lines[++i] : undefined
    const staged = code[0] !== " " && code[0] !== "?"
    const unstaged = code[1] !== " " || code === "??"
    const untracked = code === "??"
    const stat = stats.get(path)

    files.push({
      path,
      previousPath,
      title: previousPath ? `${previousPath} -> ${path}` : path,
      description: previousPath ? firstLine(path) : undefined,
      statusLabel: statusLabel(code),
      titleTone: titleTone(staged, unstaged),
      statusTone: statusTone({ untracked, staged, unstaged }),
      staged,
      unstaged,
      untracked,
      tracked: !untracked,
      additions: stat?.additions ?? 0,
      deletions: stat?.deletions ?? 0,
    })
  }

  return files.toSorted((a, b) => a.path.localeCompare(b.path))
}
