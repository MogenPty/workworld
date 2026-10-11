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
});
