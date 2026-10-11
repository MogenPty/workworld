import { createRng, restoreRng, type DeterministicRng, type RngState } from "./rng";

/**
 * Minimal deterministic simulation state. The simulation advances only
 * through `advanceTicks` with an explicit non-negative integer.
 */

export interface SimulationState {
  tick: number;
  seed: number;
  rng: RngState;
  /** Session configuration recorded for save metadata. */
  session?: SessionRecord;
  /** Domain event log (bounded, deterministic). */
  log: string[];
}

export interface SessionRecord {
  gameDefinitionId: string;
  gameDefinitionVersion: string;
  modeId: string;
  modeVersion: string;
  scenarioId: string;
  scenarioVersion: string;
}

export interface CreateSimulationOptions {
  seed: number;
  startingTick?: number;
  session?: SessionRecord;
}

export function createSimulation(options: CreateSimulationOptions): SimulationState {
  const { seed, startingTick = 0, session } = options;
  if (!Number.isInteger(seed)) throw new RangeError("seed must be an integer");
  if (!Number.isInteger(startingTick) || startingTick < 0) {
    throw new RangeError("startingTick must be a non-negative integer");
  }
  const rng = createRng(seed);
  return { tick: startingTick, seed, rng: rng.getState(), session, log: [] };
}

export interface AdvanceResult {
  state: SimulationState;
  ticksAdvanced: number;
}

/**
 * Advance the simulation by exactly `ticks` ticks. Pure and deterministic:
 * identical input state + ticks => identical output state.
 */
export function advanceTicks(state: SimulationState, ticks: number): SimulationState {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new RangeError(`ticks must be a non-negative integer, got ${ticks}`);
  }
  if (ticks === 0) return state;
  const rng: DeterministicRng = restoreRng(state.rng);
  // Consume one deterministic draw per tick so future stochastic systems
  // stay reproducible and continuation after save/load is exact.
  for (let i = 0; i < ticks; i++) rng.next();
  return {
    ...state,
    tick: state.tick + ticks,
    rng: rng.getState(),
    log: state.log,
  };
}

export function cloneState(state: SimulationState): SimulationState {
  return {
    tick: state.tick,
    seed: state.seed,
    rng: { ...state.rng },
    session: state.session ? { ...state.session } : undefined,
    log: [...state.log],
  };
}
