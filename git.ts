import type { GitFile } from "./change-set"
import { createGitChangeSet } from "./change-set"
import { commitArgs } from "./commit-message"
import type { Api } from "./types"

export type GitResult = {
  code: number
  stdout: string
  stderr: string
}

export const createGit = (api: Api) => {
  const cwd = () => api.state.path.worktree || api.state.path.directory || process.cwd()

  const run = async (args: string[], options?: { allowFailure?: boolean }): Promise<GitResult> => {
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

    if (code !== 0 && !options?.allowFailure) {
      throw new Error((stderr || stdout || `git ${args.join(" ")} failed`).trim())
    }

    return { code, stdout, stderr }
  }

  return {
    async status() {
      const [state, stat] = await Promise.all([
        run(["status", "--porcelain", "-z", "--find-renames=50%"]),
        run(["diff", "--numstat", "-z", "HEAD"], { allowFailure: true }),
      ])
      return createGitChangeSet(state.stdout, stat.stdout)
    },
    stageFile(file: GitFile) {
      return run(["add", "--", file.path])
    },
    stageAll() {
      return run(["add", "-A"])
    },
    unstageFile(file: GitFile) {
      if (file.untracked && file.staged) return run(["rm", "--cached", "--force", "--", file.path])
      return run(["reset", "HEAD", "--", file.path])
    },
    unstageAll() {
      return run(["reset"])
    },
    stagedDiff() {
      return run(["diff", "--cached", "--no-color", "--find-renames"])
    },
    stagedStat() {
      return run(["diff", "--cached", "--stat"])
    },
    async unpushedCommits() {
      const upstream = await run(["rev-list", "--count", "@{upstream}..HEAD"], { allowFailure: true })
      if (upstream.code === 0) return Number(upstream.stdout.trim()) || 0

      const remote = await run(["rev-list", "--count", "HEAD", "--not", "--remotes"], { allowFailure: true })
      if (remote.code === 0) return Number(remote.stdout.trim()) || 0

      return 0
    },
    commit(message: string) {
      return run(commitArgs(message))
    },
    push() {
      return run(["push"])
    },
  }
}
