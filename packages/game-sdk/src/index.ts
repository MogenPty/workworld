/**
 * game-sdk: typed contracts for game definitions, modes, and scenarios.
 * These are three distinct first-class concepts and must not be merged
 * into a single configuration object.
 */

/** Describes the game itself: identity, industry, content, rules. */
export interface GameDefinition {
  id: string;
  version: string;
  name: string;
  codename: string;
  industry: string;
  supportedSkillIds: string[];
  supportedRoleIds: string[];
  extensionPoints: string[];
}

/** A way of operating within a game (methodology, workflows, rules). */
export interface GameMode {
  id: string;
  version: string;
  gameDefinitionId: string;
  name: string;
  description: string;
  /** Mode-specific configuration; contract owned by the game definition. */
  config: Record<string, unknown>;
}

/** Initial conditions + objectives for one playthrough. */
export interface Scenario {
  id: string;
  version: string;
  gameDefinitionId: string;
  /** Mode ids this scenario can run with. Empty = any supported mode. */
  compatibleModeIds: string[];
  name: string;
  description: string;
  startingTick: number;
  startingSeed: number;
  startingResources: Record<string, number>;
  /**
   * Typed starting career state (initial skills + traits). Optional so
   * games without a career system can omit it; when present it must satisfy
   * `validateStartingCareer` against the owning game's catalogs.
   */
  startingCareer?: ScenarioStartingCareer;
  objectives: ScenarioObjective[];
  constraints: ScenarioConstraint[];
}

/**
 * Typed starting career state for a scenario: initial skill and trait
 * values. Generic over the map types so other games can narrow the
 * contract to their own skill/trait ids, e.g.
 * `ScenarioStartingCareer<Record<"farming" | "cooking", number>, ...>`.
 * Skill/trait values are integers in 0..100 unless a game documents
 * otherwise and validates with explicit bounds.
 */
export interface ScenarioStartingCareer<
  SkillMap extends Record<string, number> = Record<string, number>,
  TraitMap extends Record<string, number> = Record<string, number>,
> {
  skills: SkillMap;
  traits: TraitMap;
}

export interface ScenarioObjective {
  id: string;
  description: string;
}

export interface ScenarioConstraint {
  id: string;
  description: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

export function validateGameDefinition(def: GameDefinition): string[] {
  const errors: string[] = [];
  if (!def.id) errors.push("game definition id is required");
  if (!def.version) errors.push("game definition version is required");
  if (!def.supportedSkillIds?.length) errors.push("at least one supported skill is required");
  if (!def.supportedRoleIds?.length) errors.push("at least one supported role is required");
  return errors;
}

export function validateGameMode(mode: GameMode): string[] {
  const errors: string[] = [];
  if (!mode.id) errors.push("mode id is required");
  if (!mode.version) errors.push("mode version is required");
  if (!mode.gameDefinitionId) errors.push("mode must reference a game definition");
  return errors;
}

export function validateScenario(
  scenario: Scenario,
  careerContext?: {
    allowedSkillIds: readonly string[];
    allowedTraitIds: readonly string[];
    min?: number;
    max?: number;
  },
): string[] {
  const errors: string[] = [];
  if (!scenario.id) errors.push("scenario id is required");
  if (!scenario.version) errors.push("scenario version is required");
  if (!scenario.gameDefinitionId) errors.push("scenario must reference a game definition");
  if (!Number.isInteger(scenario.startingTick) || scenario.startingTick < 0) {
    errors.push("startingTick must be a non-negative integer");
  }
  if (!Number.isInteger(scenario.startingSeed)) errors.push("startingSeed must be an integer");
  if (scenario.startingCareer !== undefined) {
    errors.push(
      ...validateStartingCareer(
        scenario.startingCareer,
        careerContext ?? { allowedSkillIds: [], allowedTraitIds: [], shapeOnly: true },
      ),
    );
  }
  return errors;
}

/**
 * Validate a scenario's starting skill/trait conditions.
 *
 * - With `allowedSkillIds`/`allowedTraitIds`: identifiers must be listed
 *   and values must be integers within [min, max] (default 0..100).
 * - With `shapeOnly: true` (used when the owning game's catalogs are not
 *   available): only the object shape and integer values are checked.
 */
export function validateStartingCareer(
  input: unknown,
  opts: {
    allowedSkillIds: readonly string[];
    allowedTraitIds: readonly string[];
    min?: number;
    max?: number;
    /** When true, skip identifier allow-list checks (shape + ranges only). */
    shapeOnly?: boolean;
  },
): string[] {
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return ["startingCareer must be an object"];
  }
  const { skills, traits } = input as Record<string, unknown>;
  const shapeOnly = opts.shapeOnly === true;
  for (const [label, value, allowed] of [
    ["skills", skills, shapeOnly ? undefined : opts.allowedSkillIds],
    ["traits", traits, shapeOnly ? undefined : opts.allowedTraitIds],
  ] as const) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`startingCareer.${label} must be an object`);
      continue;
    }
    for (const [id, v] of Object.entries(value as Record<string, unknown>)) {
      if (id.length === 0) errors.push(`startingCareer.${label} contains an empty id`);
      else if (allowed !== undefined && !(allowed as readonly string[]).includes(id)) {
        errors.push(`unknown starting ${label === "skills" ? "skill" : "trait"}: ${id}`);
      }
      if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) {
        errors.push(`starting ${label === "skills" ? "skill" : "trait"} "${id}" out of range ${min}..${max}: ${String(v)}`);
      }
    }
  }
  return errors;
}

/**
 * Explicit compatibility check between a game definition, a mode, and a
 * scenario. All three must agree on the game id; the scenario must list
 * the mode (or declare itself mode-agnostic with an empty list).
 */
export function checkCompatibility(
  game: GameDefinition,
  mode: GameMode,
  scenario: Scenario,
): CompatibilityResult {
  const reasons: string[] = [];
  if (mode.gameDefinitionId !== game.id) {
    reasons.push(`mode "${mode.id}" belongs to game "${mode.gameDefinitionId}", not "${game.id}"`);
  }
  if (scenario.gameDefinitionId !== game.id) {
    reasons.push(`scenario "${scenario.id}" belongs to game "${scenario.gameDefinitionId}", not "${game.id}"`);
  }
  if (scenario.compatibleModeIds.length > 0 && !scenario.compatibleModeIds.includes(mode.id)) {
    reasons.push(`scenario "${scenario.id}" is not compatible with mode "${mode.id}"`);
  }
  return { compatible: reasons.length === 0, reasons };
}

/** Minimal in-memory registry used by the harness and tests. */
export class Registry<T extends { id: string; version: string }> {
  private items = new Map<string, T>();

  register(item: T): void {
    const key = `${item.id}@${item.version}`;
    if (this.items.has(key)) throw new Error(`duplicate registration: ${key}`);
    this.items.set(key, item);
  }

  get(id: string, version: string): T | undefined {
    return this.items.get(`${id}@${version}`);
  }

  list(): T[] {
    return [...this.items.values()];
  }
}
