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
  args: ReadonlyArray<string>
  failure: "throw" | "allow"
}>

export const createGit = ({ api }: { api: Api }) => {
  const cwd = () => api.state.path.worktree || api.state.path.directory || process.cwd()

  const run = async ({ args, failure }: GitRunInput): Promise<GitResult> => {
    const proc = Bun.spawn(["git", ...args], {
      cwd: cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    })

    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])

    if (code !== 0 && failure === "throw") {
      throw new Error((stderr || stdout || `git ${args.join(" ")} failed`).trim())
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
  }
}
