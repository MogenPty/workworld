import { describe, expect, it } from "vitest";
import { checkCompatibility, validateScenario } from "@workworld/game-sdk";
import { AGILE_MODE, CODEWORKS_DEFINITION, DEFAULT_SCENARIO, validateDefaultScenarioCareer } from "./index";
import { SKILL_CATALOG } from "@workworld/career-systems";
import { TRAIT_CATALOG } from "@workworld/career-systems";

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
  it("scenario starting career uses the typed contract and validates", () => {
    expect(DEFAULT_SCENARIO.startingCareer).toBeDefined();
    expect(validateDefaultScenarioCareer()).toEqual([]);
    expect(
      validateScenario(DEFAULT_SCENARIO, {
        allowedSkillIds: SKILL_CATALOG.map((s) => s.id),
        allowedTraitIds: TRAIT_CATALOG.map((t) => t.id),
      }),
    ).toEqual([]);
  });
  it("scenario starting career rejects unknown ids and out-of-range values", () => {
    const badId = {
      ...DEFAULT_SCENARIO,
      startingCareer: { skills: { mindreading: 10 }, traits: {} },
    };
    expect(
      validateScenario(badId, {
        allowedSkillIds: SKILL_CATALOG.map((s) => s.id),
        allowedTraitIds: TRAIT_CATALOG.map((t) => t.id),
      }).length,
    ).toBeGreaterThan(0);
    const badRange = {
      ...DEFAULT_SCENARIO,
      startingCareer: { skills: { programming: 250 }, traits: {} },
    };
    expect(
      validateScenario(badRange, {
        allowedSkillIds: SKILL_CATALOG.map((s) => s.id),
        allowedTraitIds: TRAIT_CATALOG.map((t) => t.id),
      }).length,
    ).toBeGreaterThan(0);
  });
});
