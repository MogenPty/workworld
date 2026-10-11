/**
 * Seeded deterministic RNG (mulberry32) with explicit serializable state.
 * The simulation core must never use unseeded global randomness.
 */

export interface RngState {
  seed: number;
  counter: number;
}

export interface DeterministicRng {
  next(): number;
  nextInt(min: number, max: number): number;
  getState(): RngState;
}

export function createRng(seed: number, counter = 0): DeterministicRng {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`seed must be an integer, got ${seed}`);
  }
  if (!Number.isInteger(counter) || counter < 0) {
    throw new RangeError(`counter must be a non-negative integer, got ${counter}`);
  }
  // Normalize to uint32.
  let s = seed >>> 0;
  let c = counter;
  // NOTE: draws are a pure function of (s + c), so restoring at an
  // arbitrary counter needs no replay — continuation is O(1).

  return {
    next(): number {
      const value = mulberry32Step(s + c);
      c += 1;
      return value;
    },
    nextInt(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`invalid int range [${min}, ${max}]`);
      }
      const r = (this as DeterministicRng).next();
      return min + Math.floor(r * (max - min + 1));
    },
    getState(): RngState {
      return { seed: s, counter: c };
    },
  };
}

export function restoreRng(state: RngState): DeterministicRng {
  if (!state || !Number.isInteger(state.seed) || !Number.isInteger(state.counter) || state.counter < 0) {
    throw new RangeError("invalid RNG state");
  }
  return createRng(state.seed, state.counter);
}

function mulberry32Step(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
