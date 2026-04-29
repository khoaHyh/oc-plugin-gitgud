import { describe, expect, test } from "bun:test"
import { defaultConfig, normalizeConfig } from "./config"

describe("GitGud config", () => {
  test("normalizes package export config names", () => {
    expect(
      normalizeConfig({
        enabled: false,
        replace_sidebar_files: true,
        confirm_push: false,
        confirm_stage_all_on_commit: false,
        commit_agent: "plan",
      }),
    ).toEqual({
      enabled: false,
      replaceSidebarFiles: true,
      confirmPush: false,
      confirmStageAllOnCommit: false,
      commitAgent: "plan",
    })
  })

  test("falls back to defaults for missing or malformed options", () => {
    expect(normalizeConfig({ commit_agent: "" })).toEqual(defaultConfig)
    expect(normalizeConfig(undefined)).toEqual(defaultConfig)
  })
})
