import type { GitFile } from "./change-set"
import { createGitChangeSet } from "./change-set"
import { commitArgs } from "./commit-message"
import type { Api } from "./types"

export type GitResult = Readonly<{
  code: number
  stdout: string
  stderr: string
}>

type GitRunInput = Readonly<{
  bin?: "git" | "gt"
  args: ReadonlyArray<string>
  failure: "throw" | "allow"
}>

export const graphiteModifyAllArgs = ({ message }: { message: string }): ReadonlyArray<string> => {
  return ["modify", "--commit", "--all", "--message", message]
}

export const createGit = ({ api }: { api: Api }) => {
  const cwd = () => api.state.path.worktree || api.state.path.directory || process.cwd()

  const run = async ({ bin = "git", args, failure }: GitRunInput): Promise<GitResult> => {
    let proc: ReturnType<typeof Bun.spawn>
    try {
      proc = Bun.spawn([bin, ...args], {
        cwd: cwd(),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (failure === "allow") return { code: 1, stdout: "", stderr: message }
      throw error
    }

    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])

    if (code !== 0 && failure === "throw") {
      throw new Error((stderr || stdout || `${bin} ${args.join(" ")} failed`).trim())
    }

    return { code, stdout, stderr }
  }

  return {
    async status() {
      const [state, stat] = await Promise.all([
        run({ args: ["status", "--porcelain", "-z", "--find-renames=50%"], failure: "throw" }),
        run({ args: ["diff", "--numstat", "-z", "HEAD"], failure: "allow" }),
      ])
      return createGitChangeSet({ statusOutput: state.stdout, numstatOutput: stat.stdout })
    },
    stageFile(file: GitFile) {
      return run({ args: ["add", "--", file.path], failure: "throw" })
    },
    stageAll() {
      return run({ args: ["add", "-A"], failure: "throw" })
    },
    unstageFile(file: GitFile) {
      if (file.untracked && file.staged) {
        return run({ args: ["rm", "--cached", "--force", "--", file.path], failure: "throw" })
      }
      return run({ args: ["reset", "HEAD", "--", file.path], failure: "throw" })
    },
    unstageAll() {
      return run({ args: ["reset"], failure: "throw" })
    },
    stagedDiff() {
      return run({ args: ["diff", "--cached", "--no-color", "--find-renames"], failure: "throw" })
    },
    stagedStat() {
      return run({ args: ["diff", "--cached", "--stat"], failure: "throw" })
    },
    changedDiff() {
      return run({ args: ["diff", "HEAD", "--no-color", "--find-renames"], failure: "throw" })
    },
    changedStat() {
      return run({ args: ["diff", "--stat", "HEAD"], failure: "throw" })
    },
    async unpushedCommits() {
      const upstream = await run({ args: ["rev-list", "--count", "@{upstream}..HEAD"], failure: "allow" })
      if (upstream.code === 0) return Number(upstream.stdout.trim()) || 0

      const remote = await run({ args: ["rev-list", "--count", "HEAD", "--not", "--remotes"], failure: "allow" })
      if (remote.code === 0) return Number(remote.stdout.trim()) || 0

      return 0
    },
    commit({ message }: { message: string }) {
      return run({ args: commitArgs({ message }), failure: "throw" })
    },
    push() {
      return run({ args: ["push"], failure: "throw" })
    },
    graphiteLogShort() {
      return run({ bin: "gt", args: ["log", "short"], failure: "allow" })
    },
    graphiteCreate({ branch }: { branch: string }) {
      return run({ bin: "gt", args: ["create", branch, "--no-interactive"], failure: "throw" })
    },
    graphiteModify({ message }: { message: string }) {
      return run({ bin: "gt", args: ["modify", "--commit", "--message", message], failure: "throw" })
    },
    graphiteModifyAll({ message }: { message: string }) {
      return run({ bin: "gt", args: graphiteModifyAllArgs({ message }), failure: "throw" })
    },
    graphiteSubmitStack() {
      return run({ bin: "gt", args: ["submit", "--stack"], failure: "throw" })
    },
    graphiteSync() {
      return run({ bin: "gt", args: ["sync"], failure: "throw" })
    },
    graphiteUp() {
      return run({ bin: "gt", args: ["up"], failure: "throw" })
    },
    graphiteDown() {
      return run({ bin: "gt", args: ["down"], failure: "throw" })
    },
  }
}
