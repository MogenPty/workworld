/**
 * Traits represent behavioral tendencies, distinct from skills.
 * Foundation only: typed values (0..100) plus documentation of how
 * traits MAY eventually influence performance or learning.
 *
 * Eventual influence (not yet implemented):
 * - Traits act as small modifiers on task performance rolls and on
 *   skill learning rates, never as hard gates.
 * - Example: higher "diligence" slightly reduces defect probability;
 *   higher "mentorship-affinity" slightly boosts mentoring outcomes.
 * No personality simulation is implemented in this milestone.
 */

export const TRAIT_MIN = 0;
export const TRAIT_MAX = 100;

export interface TraitDef {
  id: string;
  name: string;
  description: string;
}

export const TRAIT_CATALOG: TraitDef[] = [
  { id: "diligence", name: "Diligence", description: "Care and thoroughness in work." },
  { id: "creativity", name: "Creativity", description: "Novel approaches to problems." },
  { id: "sociability", name: "Sociability", description: "Ease in collaborative settings." },
  { id: "adaptability", name: "Adaptability", description: "Comfort with change and ambiguity." },
  { id: "leadership-affinity", name: "Leadership Affinity", description: "Tendency to guide others." },
];

export type TraitSet = Record<string, number>;

export function validateTraitValue(value: number): void {
  if (!Number.isInteger(value) || value < TRAIT_MIN || value > TRAIT_MAX) {
    throw new RangeError(`trait value must be an integer ${TRAIT_MIN}..${TRAIT_MAX}, got ${value}`);
  }
}

export function createTraitSet(partial: Record<string, number> = {}): TraitSet {
  const set: TraitSet = {};
  for (const def of TRAIT_CATALOG) set[def.id] = 50;
  for (const [id, value] of Object.entries(partial)) {
    if (!TRAIT_CATALOG.some((d) => d.id === id)) throw new Error(`unknown trait: ${id}`);
    validateTraitValue(value);
    set[id] = value;
  }
  return set;
}
