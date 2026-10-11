import { describe, expect, it } from "vitest";
import { advanceTicks, createSimulation } from "@workworld/simulation-core";
import {
  InMemoryStorage,
  SAVE_SCHEMA_VERSION,
  createSaveData,
  migrateSave,
  restoreSimulation,
  validateSaveData,
} from "./save";

function makeSave(name = "test") {
  const sim = advanceTicks(createSimulation({ seed: 42 }), 40);
  return createSaveData({
    name,
    gameDefinitionId: "codeworks",
    gameDefinitionVersion: "0.1.0",
    modeId: "agile",
    modeVersion: "0.1.0",
    scenarioId: "first-day",
    scenarioVersion: "0.1.0",
    simulation: sim,
    career: { skills: { programming: 25 }, traits: { diligence: 60 } },
  });
}

describe("persistence", () => {
  it("save carries schema + game/mode/scenario versions", () => {
    const save = makeSave();
    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(save.gameDefinitionId).toBe("codeworks");
    expect(save.modeId).toBe("agile");
    expect(save.scenarioId).toBe("first-day");
    expect(save.simulation.tick).toBe(40);
  });

  it("round-trips through storage", async () => {
    const storage = new InMemoryStorage();
    await storage.save(makeSave("slot-1"));
    const loaded = await storage.load("slot-1");
    expect(loaded.simulation.tick).toBe(40);
    expect(loaded.career.skills["programming"]).toBe(25);
    expect((await storage.list()).map((s) => s.name)).toContain("slot-1");
    await storage.delete("slot-1");
    expect(await storage.list()).toEqual([]);
  });

  it("continues deterministically after save/load", async () => {
    const storage = new InMemoryStorage();
    await storage.save(makeSave("cont"));
    const loaded = await storage.load("cont");
    const resumed = advanceTicks(restoreSimulation(loaded), 10);
    const direct = advanceTicks(createSimulation({ seed: 42 }), 50);
    expect(resumed.tick).toBe(direct.tick);
    expect(resumed.rng).toEqual(direct.rng);
  });

  it("rejects missing saves, corruption, and incompatible versions", async () => {
    const storage = new InMemoryStorage();
    await expect(storage.load("missing")).rejects.toThrow("not found");

    await storage.save(makeSave("bad"));
    storage.corrupt("bad", (raw) => {
      (raw["simulation"] as Record<string, unknown>)["tick"] = "tomorrow";
    });
    await expect(storage.load("bad")).rejects.toThrow();

    expect(validateSaveData(null).ok).toBe(false);
    expect(validateSaveData({ schemaVersion: 999 }).ok).toBe(false);
    const migrated = migrateSave({ schemaVersion: 999 });
    expect(migrated.ok).toBe(false);
    if (!migrated.ok) expect(migrated.error).toContain("No migration path");
  });

  it("rejects null nested objects without throwing TypeError", () => {
    for (const key of ["simulation", "career"] as const) {
      const save = makeSave("null-nested") as unknown as Record<string, unknown>;
      save[key] = null;
      let result: ReturnType<typeof validateSaveData>;
      expect(() => {
        result = validateSaveData(save);
      }).not.toThrow();
      expect(result!.ok).toBe(false);
    }
    const rngNull = makeSave("null-rng") as unknown as Record<string, unknown>;
    (rngNull["simulation"] as Record<string, unknown>)["rng"] = null;
    expect(() => validateSaveData(rngNull)).not.toThrow();
    expect(validateSaveData(rngNull).ok).toBe(false);

    const sessionNull = makeSave("null-session") as unknown as Record<string, unknown>;
    (sessionNull["simulation"] as Record<string, unknown>)["session"] = null;
    expect(validateSaveData(sessionNull).ok).toBe(false);
  });

  it("rejects missing fields and malformed arrays/objects", () => {
    const missing = makeSave("missing-field") as unknown as Record<string, unknown>;
    delete missing["career"];
    expect(validateSaveData(missing).ok).toBe(false);

    const badLog = makeSave("bad-log") as unknown as Record<string, unknown>;
    (badLog["simulation"] as Record<string, unknown>)["log"] = "not-an-array";
    expect(validateSaveData(badLog).ok).toBe(false);

    const badLogEntries = makeSave("bad-log-entries") as unknown as Record<string, unknown>;
    (badLogEntries["simulation"] as Record<string, unknown>)["log"] = ["ok", 42];
    expect(validateSaveData(badLogEntries).ok).toBe(false);

    const arraySkills = makeSave("array-skills") as unknown as Record<string, unknown>;
    (arraySkills["career"] as Record<string, unknown>)["skills"] = ["programming"];
    expect(validateSaveData(arraySkills).ok).toBe(false);

    const nullTraits = makeSave("null-traits") as unknown as Record<string, unknown>;
    (nullTraits["career"] as Record<string, unknown>)["traits"] = null;
    expect(() => validateSaveData(nullTraits)).not.toThrow();
    expect(validateSaveData(nullTraits).ok).toBe(false);
  });

  it("rejects invalid RNG counters and seeds", () => {
    const negCounter = makeSave("neg-counter") as unknown as Record<string, unknown>;
    (negCounter["simulation"] as Record<string, unknown>)["rng"] = { seed: 42, counter: -1 };
    expect(validateSaveData(negCounter).ok).toBe(false);

    const floatCounter = makeSave("float-counter") as unknown as Record<string, unknown>;
    (floatCounter["simulation"] as Record<string, unknown>)["rng"] = { seed: 42, counter: 1.5 };
    expect(validateSaveData(floatCounter).ok).toBe(false);

    const stringSeed = makeSave("string-seed") as unknown as Record<string, unknown>;
    (stringSeed["simulation"] as Record<string, unknown>)["seed"] = "42";
    expect(validateSaveData(stringSeed).ok).toBe(false);

    const negTick = makeSave("neg-tick") as unknown as Record<string, unknown>;
    (negTick["simulation"] as Record<string, unknown>)["tick"] = -1;
    expect(validateSaveData(negTick).ok).toBe(false);
  });

  it("rejects out-of-range and unknown skills/traits", () => {
    const badSkill = makeSave("bad-skill") as unknown as Record<string, unknown>;
    (badSkill["career"] as Record<string, unknown>)["skills"] = { programming: 101 };
    const r1 = validateSaveData(badSkill);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toContain("programming");

    const unknownSkill = makeSave("unknown-skill") as unknown as Record<string, unknown>;
    (unknownSkill["career"] as Record<string, unknown>)["skills"] = { mindreading: 10 };
    expect(validateSaveData(unknownSkill).ok).toBe(false);

    const floatTrait = makeSave("float-trait") as unknown as Record<string, unknown>;
    (floatTrait["career"] as Record<string, unknown>)["traits"] = { diligence: 60.5 };
    expect(validateSaveData(floatTrait).ok).toBe(false);

    const negTrait = makeSave("neg-trait") as unknown as Record<string, unknown>;
    (negTrait["career"] as Record<string, unknown>)["traits"] = { diligence: -1 };
    expect(validateSaveData(negTrait).ok).toBe(false);
  });

  it("rejects inconsistent session metadata and bad metadata types", () => {
    const sim = advanceTicks(createSimulation({ seed: 42 }), 40);
    const mismatched = createSaveData({
      name: "mismatch",
      gameDefinitionId: "codeworks",
      gameDefinitionVersion: "0.1.0",
      modeId: "agile",
      modeVersion: "0.1.0",
      scenarioId: "first-day",
      scenarioVersion: "0.1.0",
      simulation: {
        ...sim,
        session: {
          gameDefinitionId: "codeworks",
          gameDefinitionVersion: "0.1.0",
          modeId: "kanban",
          modeVersion: "0.1.0",
          scenarioId: "first-day",
          scenarioVersion: "0.1.0",
        },
      },
      career: { skills: { programming: 25 }, traits: { diligence: 60 } },
    });
    const r = validateSaveData(mismatched);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("disagree");

    const matching = createSaveData({
      name: "match",
      gameDefinitionId: "codeworks",
      gameDefinitionVersion: "0.1.0",
      modeId: "agile",
      modeVersion: "0.1.0",
      scenarioId: "first-day",
      scenarioVersion: "0.1.0",
      simulation: {
        ...sim,
        session: {
          gameDefinitionId: "codeworks",
          gameDefinitionVersion: "0.1.0",
          modeId: "agile",
          modeVersion: "0.1.0",
          scenarioId: "first-day",
          scenarioVersion: "0.1.0",
        },
      },
      career: { skills: { programming: 25 }, traits: { diligence: 60 } },
    });
    expect(validateSaveData(matching).ok).toBe(true);

    const emptyName = makeSave("x") as unknown as Record<string, unknown>;
    emptyName["name"] = "";
    expect(validateSaveData(emptyName).ok).toBe(false);

    const emptyId = makeSave("x") as unknown as Record<string, unknown>;
    emptyId["scenarioId"] = "";
    expect(validateSaveData(emptyId).ok).toBe(false);
  });

  it("preserves stored data after a failed load", async () => {
    const storage = new InMemoryStorage();
    await storage.save(makeSave("slot"));
    const before = await storage.load("slot");
    storage.corrupt("slot", (raw) => {
      (raw["simulation"] as Record<string, unknown>)["tick"] = "tomorrow";
    });
    await expect(storage.load("slot")).rejects.toThrow();
    // Repair back to the original tick: the stored record itself was never
    // overwritten or deleted by the failed load.
    storage.corrupt("slot", (raw) => {
      (raw["simulation"] as Record<string, unknown>)["tick"] = before.simulation.tick;
    });
    const after = await storage.load("slot");
    expect(after.simulation.tick).toBe(before.simulation.tick);
  });
});
