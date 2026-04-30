export type CommitMessageParts = {
  summary: string
  description: string
}

type TextPart = {
  type: "text"
  text: string
}

export const commitMessageParts = (message: string): CommitMessageParts => {
  const lines = message.replaceAll("\r\n", "\n").trim().split("\n")
  return {
    summary: lines[0]?.trim() ?? "",
    description: lines.slice(1).join("\n").trim(),
  }
}

export const commitArgs = (message: string) => {
  const parts = commitMessageParts(message)
  const args = ["commit", "-m", parts.summary]
  if (parts.description) args.push("-m", parts.description)
  return args
}

export const commitMessageSystem = [
  "You write concise Git commit messages.",
  "Return only the commit message. No markdown fences. No explanation.",
  "Use an imperative subject under 72 characters. Add a short body only if it materially helps.",
  "Use conventional commits",
].join("\n")

export const commitMessageSystemWithInstructions = (instructions: string) => {
  const trimmed = instructions.trim()
  if (!trimmed) return commitMessageSystem
  return [commitMessageSystem, "Additional user instructions:", trimmed].join("\n\n")
}

export const commitMessagePrompt = (stat: string, diff: string) => {
  return `Create a commit message for this staged diff.\n\nSTAT:\n${stat}\n\nDIFF:\n${diff}`
}

const isTextPart = (part: unknown): part is TextPart => {
  return Boolean(
    part &&
    typeof part === "object" &&
    "type" in part &&
    part.type === "text" &&
    "text" in part &&
    typeof part.text === "string",
  )
}

export const textParts = (parts: readonly unknown[]) => {
  return parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n")
    .trim()
}
