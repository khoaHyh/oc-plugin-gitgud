import { describe, expect, test } from "bun:test"
import { createGitChangeSet } from "./change-set"

describe("Git change-set", () => {
  test("derives display facts from porcelain and numstat", () => {
    const files = createGitChangeSet(" M src/tui.tsx\0M  README.md\0?? scratch.txt\0", "4\t2\tsrc/tui.tsx\0")

    expect(files.map((file) => file.path)).toEqual(["README.md", "scratch.txt", "src/tui.tsx"])
    expect(files[0]).toEqual({
      path: "README.md",
      previousPath: undefined,
      title: "README.md",
      description: undefined,
      statusLabel: "M·",
      titleTone: "success",
      statusTone: "success",
      staged: true,
      unstaged: false,
      untracked: false,
      tracked: true,
      additions: 0,
      deletions: 0,
    })
    expect(files[1]?.statusLabel).toBe("??")
    expect(files[1]?.statusTone).toBe("warning")
    expect(files[2]?.statusLabel).toBe("·M")
    expect(files[2]?.additions).toBe(4)
    expect(files[2]?.deletions).toBe(2)
  })

  test("keeps rename display facts with the current path as the action path", () => {
    const files = createGitChangeSet("R  src/new.ts\0src/old.ts\0", "1\t1\tsrc/new.ts\0")

    expect(files[0]?.path).toBe("src/new.ts")
    expect(files[0]?.previousPath).toBe("src/old.ts")
    expect(files[0]?.title).toBe("src/old.ts -> src/new.ts")
    expect(files[0]?.description).toBe("src/new.ts")
  })
})
