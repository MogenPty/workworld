import type { RngState, SessionRecord, SimulationState } from "@workworld/simulation-core";
import {
  SKILL_CATALOG,
  SKILL_MAX,
  SKILL_MIN,
  TRAIT_CATALOG,
  TRAIT_MAX,
  TRAIT_MIN,
} from "@workworld/career-systems";

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

const SKILL_IDS = new Set(SKILL_CATALOG.map((s) => s.id));
const TRAIT_IDS = new Set(TRAIT_CATALOG.map((t) => t.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function validateSaveData(data: unknown): SaveValidation {
  if (!isRecord(data)) return fail("save is not an object");
  const s = data;
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

  // Required metadata must be non-empty strings (savedAt must parse as a date).
  if (!isNonEmptyString(s["name"])) return fail("save.name must be a non-empty string");
  if (typeof s["savedAt"] !== "string" || s["savedAt"].length === 0 || Number.isNaN(Date.parse(s["savedAt"]))) {
    return fail("save.savedAt must be an ISO date string");
  }
  for (const key of [
    "gameDefinitionId",
    "gameDefinitionVersion",
    "modeId",
    "modeVersion",
    "scenarioId",
    "scenarioVersion",
  ]) {
    if (!isNonEmptyString(s[key])) return fail(`save.${key} must be a non-empty string`);
  }

  // Simulation block: check the object's shape before reading properties.
  const sim = s["simulation"];
  if (!isRecord(sim)) return fail("simulation is not an object");
  if (!Number.isInteger(sim["tick"]) || (sim["tick"] as number) < 0) {
    return fail("simulation.tick is invalid");
  }
  if (!Number.isInteger(sim["seed"])) return fail("simulation.seed is invalid");
  const rng = sim["rng"];
  if (!isRecord(rng)) return fail("simulation.rng state is invalid");
  if (!Number.isInteger(rng["seed"])) return fail("simulation.rng.seed is invalid");
  if (!Number.isInteger(rng["counter"]) || (rng["counter"] as number) < 0) {
    return fail("simulation.rng.counter is invalid");
  }
  const log = sim["log"];
  if (!Array.isArray(log) || !log.every((entry) => typeof entry === "string")) {
    return fail("simulation.log must be an array of strings");
  }

  // Optional session record: shape-checked, then must agree with save metadata.
  const session = sim["session"];
  if (session !== undefined) {
    if (!isRecord(session)) return fail("simulation.session is not an object");
    for (const key of [
      "gameDefinitionId",
      "gameDefinitionVersion",
      "modeId",
      "modeVersion",
      "scenarioId",
      "scenarioVersion",
    ]) {
      if (!isNonEmptyString(session[key])) return fail(`simulation.session.${key} must be a non-empty string`);
    }
    const pairs: Array<[string, unknown, unknown]> = [
      ["gameDefinitionId", s["gameDefinitionId"], session["gameDefinitionId"]],
      ["gameDefinitionVersion", s["gameDefinitionVersion"], session["gameDefinitionVersion"]],
      ["modeId", s["modeId"], session["modeId"]],
      ["modeVersion", s["modeVersion"], session["modeVersion"]],
      ["scenarioId", s["scenarioId"], session["scenarioId"]],
      ["scenarioVersion", s["scenarioVersion"], session["scenarioVersion"]],
    ];
    for (const [key, outer, inner] of pairs) {
      if (outer !== inner) {
        return fail(`save metadata and session metadata disagree on ${key}`);
      }
    }
  }

  // Career block: shape-checked, values validated against career-system rules.
  const career = s["career"];
  if (!isRecord(career)) return fail("career is not an object");
  const skills = career["skills"];
  const traits = career["traits"];
  if (!isRecord(skills)) return fail("career.skills must be an object");
  if (!isRecord(traits)) return fail("career.traits must be an object");
  for (const [id, value] of Object.entries(skills)) {
    if (id.length === 0) return fail("career.skills contains an empty skill id");
    if (!SKILL_IDS.has(id)) return fail(`career.skills contains unknown skill: ${id}`);
    if (!Number.isInteger(value) || (value as number) < SKILL_MIN || (value as number) > SKILL_MAX) {
      return fail(`career skill "${id}" out of range ${SKILL_MIN}..${SKILL_MAX}: ${String(value)}`);
    }
  }
  for (const [id, value] of Object.entries(traits)) {
    if (id.length === 0) return fail("career.traits contains an empty trait id");
    if (!TRAIT_IDS.has(id)) return fail(`career.traits contains unknown trait: ${id}`);
    if (!Number.isInteger(value) || (value as number) < TRAIT_MIN || (value as number) > TRAIT_MAX) {
      return fail(`career trait "${id}" out of range ${TRAIT_MIN}..${TRAIT_MAX}: ${String(value)}`);
    }
  }

  return { ok: true, save: s as unknown as SaveData };
}

function fail(error: string): SaveValidation {
  return { ok: false, error };
}

/**
 * Migration boundary for future schema versions. Milestone 0.1 only reads
 * version 1; anything else is rejected with an understandable error and the
 * stored data is left untouched (callers must never overwrite the stored
 * payload on a validation failure). No migration between schema versions is
 * implemented yet; future versions add `migrateNtoM` functions here and route
 * through `migrateSave`.
 */
export function migrateSave(data: unknown): SaveValidation {
  const version =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)["schemaVersion"]
      : undefined;
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
    // Validate a deep copy so a failed load never mutates stored data.
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
