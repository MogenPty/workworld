/**
 * Skills: values range 0..100 inclusive.
 * Validation policy: `validateSkillValue` throws RangeError on invalid
 * input; `normalizeSkillValue` clamps instead. Parsers must use one of
 * the two explicitly — never silently coerce.
 */

export const SKILL_MIN = 0;
export const SKILL_MAX = 100;

export type SkillCategory =
  | "technical-engineering"
  | "quality-engineering"
  | "product-design"
  | "agile-delivery-leadership"
  | "business-management";

export interface SkillDef {
  id: string;
  name: string;
  category: SkillCategory;
}

export const SKILL_CATALOG: SkillDef[] = [
  { id: "programming", name: "Programming", category: "technical-engineering" },
  { id: "debugging", name: "Debugging", category: "technical-engineering" },
  { id: "software-design", name: "Software Design", category: "technical-engineering" },
  { id: "architecture", name: "Architecture", category: "technical-engineering" },
  { id: "databases", name: "Databases", category: "technical-engineering" },
  { id: "apis", name: "APIs", category: "technical-engineering" },
  { id: "version-control", name: "Version Control", category: "technical-engineering" },
  { id: "devops", name: "DevOps", category: "technical-engineering" },
  { id: "security", name: "Security", category: "technical-engineering" },
  { id: "testing", name: "Testing", category: "quality-engineering" },
  { id: "ui-ux", name: "UI/UX", category: "product-design" },
  { id: "estimation", name: "Estimation", category: "agile-delivery-leadership" },
  { id: "communication", name: "Communication", category: "agile-delivery-leadership" },
  { id: "mentoring", name: "Mentoring", category: "agile-delivery-leadership" },
  { id: "sales", name: "Sales", category: "business-management" },
  { id: "finance", name: "Finance", category: "business-management" },
  { id: "client-management", name: "Client Management", category: "business-management" },
];

export type SkillSet = Record<string, number>;

export function validateSkillValue(value: number): void {
  if (!Number.isInteger(value) || value < SKILL_MIN || value > SKILL_MAX) {
    throw new RangeError(`skill value must be an integer ${SKILL_MIN}..${SKILL_MAX}, got ${value}`);
  }
}

export function normalizeSkillValue(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`skill value must be finite, got ${value}`);
  return Math.min(SKILL_MAX, Math.max(SKILL_MIN, Math.round(value)));
}

export function createSkillSet(partial: Record<string, number> = {}): SkillSet {
  const set: SkillSet = {};
  for (const def of SKILL_CATALOG) set[def.id] = 0;
  for (const [id, value] of Object.entries(partial)) {
    if (!SKILL_CATALOG.some((d) => d.id === id)) throw new Error(`unknown skill: ${id}`);
    validateSkillValue(value);
    set[id] = value;
  }
  return set;
}

export function validateSkillSet(set: SkillSet): string[] {
  const errors: string[] = [];
  for (const [id, value] of Object.entries(set)) {
    if (!SKILL_CATALOG.some((d) => d.id === id)) errors.push(`unknown skill: ${id}`);
    else if (!Number.isInteger(value) || value < SKILL_MIN || value > SKILL_MAX) {
      errors.push(`skill "${id}" out of range: ${value}`);
    }
  }
  return errors;
}
