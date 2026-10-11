import { describe, expect, it } from "vitest";
import {
  Registry,
  checkCompatibility,
  validateGameDefinition,
  validateGameMode,
  validateScenario,
  validateStartingCareer,
  type GameDefinition,
  type GameMode,
  type Scenario,
} from "./index";

const game: GameDefinition = {
  id: "codeworks",
  version: "0.1.0",
  name: "CodeWorks",
  codename: "CodeWorks",
  industry: "software",
  supportedSkillIds: ["programming"],
  supportedRoleIds: ["developer"],
  extensionPoints: [],
};

const mode: GameMode = {
  id: "agile",
  version: "0.1.0",
  gameDefinitionId: "codeworks",
  name: "Agile",
  description: "Agile delivery",
  config: {},
};

const scenario: Scenario = {
  id: "default",
  version: "0.1.0",
  gameDefinitionId: "codeworks",
  compatibleModeIds: ["agile"],
  name: "Default",
  description: "Default",
  startingTick: 0,
  startingSeed: 1,
  startingResources: {},
  objectives: [],
  constraints: [],
};

describe("game-sdk contracts", () => {
  it("validates definitions, modes, scenarios", () => {
    expect(validateGameDefinition(game)).toEqual([]);
    expect(validateGameMode(mode)).toEqual([]);
    expect(validateScenario(scenario)).toEqual([]);
    expect(validateGameDefinition({ ...game, id: "" }).length).toBeGreaterThan(0);
    expect(validateScenario({ ...scenario, startingTick: -1 }).length).toBeGreaterThan(0);
  });
  it("accepts compatible triples", () => {
    expect(checkCompatibility(game, mode, scenario).compatible).toBe(true);
  });
  it("rejects mismatched game references and modes", () => {
    const other = { ...mode, gameDefinitionId: "other" };
    const r1 = checkCompatibility(game, other, scenario);
    expect(r1.compatible).toBe(false);
    const wrongMode = { ...mode, id: "kanban" };
    const r2 = checkCompatibility(game, wrongMode, scenario);
    expect(r2.compatible).toBe(false);
    expect(r2.reasons.join(";")).toContain("kanban");
  });
  it("registry rejects duplicates, resolves versions", () => {
    const reg = new Registry<GameMode>();
    reg.register(mode);
    expect(() => reg.register(mode)).toThrow();
    expect(reg.get("agile", "0.1.0")).toEqual(mode);
    expect(reg.get("agile", "9.9.9")).toBeUndefined();
  });
  it("accepts valid starting career conditions", () => {
    const withCareer: Scenario = {
      ...scenario,
      startingCareer: { skills: { programming: 25 }, traits: { diligence: 60 } },
    };
    expect(
      validateScenario(withCareer, {
        allowedSkillIds: ["programming"],
        allowedTraitIds: ["diligence"],
      }),
    ).toEqual([]);
    // Omitted startingCareer stays valid for games without a career system.
    expect(validateScenario(scenario)).toEqual([]);
  });
  it("rejects invalid starting career conditions", () => {
    const ctx = { allowedSkillIds: ["programming"], allowedTraitIds: ["diligence"] };
    const unknownSkill: Scenario = {
      ...scenario,
      startingCareer: { skills: { mindreading: 10 }, traits: {} },
    };
    expect(validateScenario(unknownSkill, ctx).length).toBeGreaterThan(0);
    const outOfRange: Scenario = {
      ...scenario,
      startingCareer: { skills: { programming: 101 }, traits: {} },
    };
    expect(validateScenario(outOfRange, ctx).length).toBeGreaterThan(0);
    const nonInteger: Scenario = {
      ...scenario,
      startingCareer: { skills: {}, traits: { diligence: 60.5 } },
    };
    expect(validateScenario(nonInteger, ctx).length).toBeGreaterThan(0);
    const malformed: Scenario = {
      ...scenario,
      startingCareer: { skills: ["programming"] } as unknown as { skills: Record<string, number>; traits: Record<string, number> },
    };
    expect(validateScenario(malformed, ctx).length).toBeGreaterThan(0);
    expect(validateStartingCareer(null, ctx).length).toBeGreaterThan(0);
  });
});
