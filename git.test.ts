import { describe, expect, test } from "bun:test"
import { graphiteModifyAllArgs, graphiteModifyArgs, graphiteSubmitStackArgs } from "./git"

describe("Git process adapter", () => {
  test("uses non-interactive Graphite modify command", () => {
    expect(graphiteModifyArgs({ message: "fix: update stack changes" })).toEqual([
      "modify",
      "--commit",
      "--message",
      "fix: update stack changes",
      "--no-interactive",
    ])
  })

  test("uses Graphite's native all-changes modify command", () => {
    expect(graphiteModifyAllArgs({ message: "feat: add stack changes" })).toEqual([
      "modify",
      "--commit",
      "--all",
      "--message",
      "feat: add stack changes",
      "--no-interactive",
    ])
  })

  test("submits Graphite stacks without prompts or metadata generation", () => {
    expect(graphiteSubmitStackArgs()).toEqual(["submit", "--stack", "--no-interactive", "--no-edit", "--no-ai"])
  })
})
