/**
 * Career levels. These are NOT a single linear promotion ladder:
 * - technical: Intern -> Junior -> Intermediate -> Senior -> Lead -> Principal
 * - management: Manager (distinct dimension)
 * - business: Business Owner (distinct dimension)
 */

export type CareerLevel =
  | "intern"
  | "junior"
  | "intermediate"
  | "senior"
  | "lead"
  | "principal"
  | "manager"
  | "business-owner";

export type CareerDimension = "technical" | "management" | "business";

export const CAREER_LEVELS: CareerLevel[] = [
  "intern",
  "junior",
  "intermediate",
  "senior",
  "lead",
  "principal",
  "manager",
  "business-owner",
];

const TECHNICAL_RANK: Record<string, number> = {
  intern: 0,
  junior: 1,
  intermediate: 2,
  senior: 3,
  lead: 4,
  principal: 5,
};

export function careerDimension(level: CareerLevel): CareerDimension {
  if (level === "manager") return "management";
  if (level === "business-owner") return "business";
  return "technical";
}

/** Rank within the technical IC track, or null for other dimensions. */
export function technicalRank(level: CareerLevel): number | null {
  return level in TECHNICAL_RANK ? TECHNICAL_RANK[level] : null;
}

/** True when `level` is at least `minimum` on the technical track. */
export function isTechnicalAtLeast(level: CareerLevel, minimum: CareerLevel): boolean {
  const a = technicalRank(level);
  const b = technicalRank(minimum);
  if (a === null || b === null) return false;
  return a >= b;
}
