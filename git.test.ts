import { describe, expect, test } from "bun:test"
import { graphiteModifyAllArgs } from "./git"

describe("Git process adapter", () => {
  test("uses Graphite's native all-changes modify command", () => {
    expect(graphiteModifyAllArgs({ message: "feat: add stack changes" })).toEqual([
      "modify",
      "--commit",
      "--all",
      "--message",
      "feat: add stack changes",
    ])
  })
})
