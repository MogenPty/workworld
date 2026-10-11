import { describe, expect, it } from "vitest";
import { checkCompatibility } from "@workworld/game-sdk";
import { AGILE_MODE, CODEWORKS_DEFINITION, DEFAULT_SCENARIO } from "./index";

describe("codeworks registration", () => {
  it("definition, agile mode, and default scenario are compatible", () => {
    const result = checkCompatibility(CODEWORKS_DEFINITION, AGILE_MODE, DEFAULT_SCENARIO);
    expect(result.reasons).toEqual([]);
    expect(result.compatible).toBe(true);
  });
  it("definition supports the career skill catalogue", () => {
    expect(CODEWORKS_DEFINITION.supportedSkillIds).toContain("programming");
    expect(CODEWORKS_DEFINITION.supportedSkillIds).toContain("client-management");
  });
  it("scenario carries starting conditions", () => {
    expect(DEFAULT_SCENARIO.startingResources["funds"]).toBeGreaterThan(0);
    expect(DEFAULT_SCENARIO.objectives.length).toBeGreaterThan(0);
  });
});
