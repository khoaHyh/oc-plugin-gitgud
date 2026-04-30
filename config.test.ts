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
        commit_model: "anthropic/claude-sonnet-4-20250514",
        commit_system_instructions: "Prefer short commit bodies.",
        keybinds: {
          open_status: "leader x s",
          push: false,
        },
      }),
    ).toEqual({
      enabled: false,
      replaceSidebarFiles: true,
      confirmPush: false,
      confirmStageAllOnCommit: false,
      commitAgent: "plan",
      commitModel: {
        providerID: "anthropic",
        modelID: "claude-sonnet-4-20250514",
      },
      commitSystemInstructions: "Prefer short commit bodies.",
      keybinds: {
        ...defaultConfig.keybinds,
        "gitgud.open_status": "leader x s",
        "gitgud.push": "none",
      },
    })
  })

  test("falls back to defaults for missing or malformed options", () => {
    expect(
      normalizeConfig({ commit_agent: "", commit_model: "missing-provider", commit_system_instructions: 1 }),
    ).toEqual(defaultConfig)
    expect(normalizeConfig(undefined)).toEqual(defaultConfig)
  })
})
