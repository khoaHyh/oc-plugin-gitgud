import { describe, expect, test } from "bun:test"
import { commitArgs, commitMessageParts, commitMessagePrompt, textParts } from "./commit-message"

describe("Commit message", () => {
  test("splits subject and body for git commit", () => {
    const message = "feat: add GitGud status\n\nShow staged files in the sidebar."

    expect(commitMessageParts(message)).toEqual({
      summary: "feat: add GitGud status",
      description: "Show staged files in the sidebar.",
    })
    expect(commitArgs(message)).toEqual([
      "commit",
      "-m",
      "feat: add GitGud status",
      "-m",
      "Show staged files in the sidebar.",
    ])
  })

  test("extracts text parts and builds the commit-agent prompt", () => {
    expect(
      textParts([
        { type: "text", text: "one" },
        { type: "tool", text: "skip" },
        { type: "text", text: "two" },
      ]),
    ).toBe("one\ntwo")
    expect(commitMessagePrompt("stat", "diff")).toContain("STAT:\nstat\n\nDIFF:\ndiff")
  })
})
