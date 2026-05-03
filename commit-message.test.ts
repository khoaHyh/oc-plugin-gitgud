import { describe, expect, test } from "bun:test"
import {
  commitArgs,
  commitMessageParts,
  commitMessagePrompt,
  commitMessageSystem,
  commitMessageSystemWithInstructions,
  textParts,
} from "./commit-message"

describe("Commit message", () => {
  test("splits a commit message into a trimmed subject and body", () => {
    expect(
      commitMessageParts({ message: " feat: add GitGud status \r\n\r\n Show staged files in the sidebar. \n" }),
    ).toEqual({
      summary: "feat: add GitGud status",
      description: "Show staged files in the sidebar.",
    })
  })

  test("passes subject and optional body as separate git commit messages", () => {
    expect(commitArgs({ message: "feat: add GitGud status\n\nShow staged files in the sidebar." })).toEqual([
      "commit",
      "-m",
      "feat: add GitGud status",
      "-m",
      "Show staged files in the sidebar.",
    ])
    expect(commitArgs({ message: "fix: refresh status" })).toEqual(["commit", "-m", "fix: refresh status"])
  })

  test("extracts only text from model response parts", () => {
    expect(
      textParts({
        parts: [
          { type: "text", text: "one" },
          null,
          { type: "text" },
          { type: "tool", text: "skip" },
          { type: "text", text: "two" },
        ],
      }),
    ).toBe("one\ntwo")
  })

  test("builds a prompt containing the staged stat and diff", () => {
    expect(commitMessagePrompt({ stat: " README.md | 2 ++", diff: "diff --git a/README.md b/README.md" })).toBe(
      "Create a commit message for this staged diff.\n\nSTAT:\n README.md | 2 ++\n\nDIFF:\ndiff --git a/README.md b/README.md",
    )
  })

  test("appends configured user instructions to the default system prompt", () => {
    expect(commitMessageSystemWithInstructions({ instructions: "  " })).toBe(commitMessageSystem)
    expect(commitMessageSystemWithInstructions({ instructions: "Prefer short bodies." })).toBe(
      `${commitMessageSystem}\n\nAdditional user instructions:\n\nPrefer short bodies.`,
    )
  })
})
