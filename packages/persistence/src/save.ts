import type { RngState, SessionRecord, SimulationState } from "@workworld/simulation-core";

/**
 * Versioned local save format. `savedAt` is metadata only — game outcomes
 * never depend on wall-clock time.
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface SaveData {
  schemaVersion: number;
  name: string;
  savedAt: string;
  gameDefinitionId: string;
  gameDefinitionVersion: string;
  modeId: string;
  modeVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  simulation: {
    tick: number;
    seed: number;
    rng: RngState;
    session?: SessionRecord;
    log: string[];
  };
  career: {
    skills: Record<string, number>;
    traits: Record<string, number>;
  };
}

export function createSaveData(input: {
  name: string;
  gameDefinitionId: string;
  gameDefinitionVersion: string;
  modeId: string;
  modeVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  simulation: SimulationState;
  career: SaveData["career"];
}): SaveData {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    name: input.name,
    savedAt: new Date().toISOString(),
    gameDefinitionId: input.gameDefinitionId,
    gameDefinitionVersion: input.gameDefinitionVersion,
    modeId: input.modeId,
    modeVersion: input.modeVersion,
    scenarioId: input.scenarioId,
    scenarioVersion: input.scenarioVersion,
    simulation: {
      tick: input.simulation.tick,
      seed: input.simulation.seed,
      rng: { ...input.simulation.rng },
      session: input.simulation.session ? { ...input.simulation.session } : undefined,
      log: [...input.simulation.log],
    },
    career: {
      skills: { ...input.career.skills },
      traits: { ...input.career.traits },
    },
  };
}

export type SaveValidation =
  | { ok: true; save: SaveData }
  | { ok: false; error: string };

export function validateSaveData(data: unknown): SaveValidation {
  if (typeof data !== "object" || data === null) return fail("save is not an object");
  const s = data as Record<string, unknown>;
  if (s["schemaVersion"] !== SAVE_SCHEMA_VERSION) {
    return fail(
      `incompatible save schema: got ${String(s["schemaVersion"])}, expected ${SAVE_SCHEMA_VERSION}. ` +
        "This save was written by a different version and cannot be loaded.",
    );
  }
  const required = [
    "name",
    "gameDefinitionId",
    "gameDefinitionVersion",
    "modeId",
    "modeVersion",
    "scenarioId",
    "scenarioVersion",
    "simulation",
    "career",
  ];
  for (const key of required) {
    if (s[key] === undefined) return fail(`save is missing required field: ${key}`);
  }
  const sim = s["simulation"] as Record<string, unknown>;
  if (!Number.isInteger(sim["tick"]) || (sim["tick"] as number) < 0) return fail("simulation.tick is invalid");
  if (!Number.isInteger(sim["seed"])) return fail("simulation.seed is invalid");
  const rng = sim["rng"] as Record<string, unknown>;
  if (!rng || !Number.isInteger(rng["seed"]) || !Number.isInteger(rng["counter"])) {
    return fail("simulation.rng state is invalid");
  }
  const career = s["career"] as Record<string, unknown>;
  if (typeof career["skills"] !== "object" || typeof career["traits"] !== "object") {
    return fail("career.skills/traits are invalid");
  }
  return { ok: true, save: s as unknown as SaveData };
}

function fail(error: string): SaveValidation {
  return { ok: false, error };
}

/**
 * Migration boundary for future schema versions. Milestone 0.1 only reads
 * version 1; anything else is rejected with an understandable error rather
 * than silently reinterpreted. Future versions add `migrateNtoM` functions
 * here and route through `migrateSave`.
 */
export function migrateSave(data: unknown): SaveValidation {
  const version = (data as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version !== SAVE_SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        `No migration path from save schema ${String(version)} to ${SAVE_SCHEMA_VERSION}. ` +
        "The save is preserved untouched; update the app or start a new session.",
    };
  }
  return validateSaveData(data);
}

export function restoreSimulation(save: SaveData): SimulationState {
  return {
    tick: save.simulation.tick,
    seed: save.simulation.seed,
    rng: { ...save.simulation.rng },
    session: save.simulation.session ? { ...save.simulation.session } : undefined,
    log: [...save.simulation.log],
  };
}

/** Storage interface — independent of UI and storage implementation. */
export interface SaveStorage {
  save(data: SaveData): Promise<void>;
  load(name: string): Promise<SaveData>;
  list(): Promise<Array<{ name: string; savedAt: string }>>;
  delete(name: string): Promise<void>;
}

export class InMemoryStorage implements SaveStorage {
  private saves = new Map<string, SaveData>();

  async save(data: SaveData): Promise<void> {
    this.saves.set(data.name, JSON.parse(JSON.stringify(data)) as SaveData);
  }

  async load(name: string): Promise<SaveData> {
    const raw = this.saves.get(name);
    if (!raw) throw new Error(`save not found: ${name}`);
    const parsed = JSON.parse(JSON.stringify(raw)) as unknown;
    const result = migrateSave(parsed);
    if (!result.ok) throw new Error(result.error);
    return result.save;
  }

  async list(): Promise<Array<{ name: string; savedAt: string }>> {
    return [...this.saves.values()].map((s) => ({ name: s.name, savedAt: s.savedAt }));
  }

  async delete(name: string): Promise<void> {
    this.saves.delete(name);
  }

  /** Test helper: corrupt the stored payload to simulate disk corruption. */
  corrupt(name: string, mutate: (raw: Record<string, unknown>) => void): void {
    const raw = this.saves.get(name) as unknown as Record<string, unknown>;
    if (!raw) throw new Error(`save not found: ${name}`);
    mutate(raw);
  }
}
