import { isTechnicalAtLeast, type CareerLevel } from "./levels";

/**
 * Reusable role-eligibility rules. Activities declare which levels may
 * act as primary / secondary participants, required skills/experience,
 * supervision requirements, and availability constraints. The Code Review
 * rule below is one instance; QA sign-off, architecture decisions,
 * mentoring, hiring, and financial approval reuse this shape.
 */

export type ParticipationKind = "primary" | "secondary";

export interface EmployeeSnapshot {
  id: string;
  level: CareerLevel;
  skills?: Record<string, number>;
  available?: boolean;
}

export interface EligibilityRule {
  activityId: string;
  /** Levels that may lead as primary participant. */
  primaryLevels: CareerLevel[];
  /** Levels that may join as secondary participants. */
  secondaryLevels: CareerLevel[];
  /** Optional: primary level allowed only with a qualified supervisor present. */
  supervisedPrimary?: {
    level: CareerLevel;
    supervisorLevels: CareerLevel[];
  };
  requiredSkills?: Record<string, number>;
  requiresAvailability?: boolean;
}

export interface EligibilityEvaluation {
  eligible: boolean;
  reasons: string[];
}

export function evaluateEligibility(
  rule: EligibilityRule,
  employee: EmployeeSnapshot,
  kind: ParticipationKind,
  team: EmployeeSnapshot[] = [],
): EligibilityEvaluation {
  const reasons: string[] = [];
  const allowed = kind === "primary" ? rule.primaryLevels : rule.secondaryLevels;

  let levelOk = allowed.includes(employee.level);
  if (!levelOk && kind === "primary" && rule.supervisedPrimary && employee.level === rule.supervisedPrimary.level) {
    const supervisorPresent = team.some(
      (t) => t.id !== employee.id && rule.supervisedPrimary!.supervisorLevels.includes(t.level),
    );
    if (supervisorPresent) {
      levelOk = true;
    } else {
      reasons.push(
        `${employee.level} may lead ${rule.activityId} only with a participating supervisor (${rule.supervisedPrimary.supervisorLevels.join("/")} required)`,
      );
    }
  }
  if (!levelOk && reasons.length === 0) {
    reasons.push(`${employee.level} may not participate in ${rule.activityId} as ${kind}`);
  }

  if (rule.requiredSkills) {
    for (const [skill, min] of Object.entries(rule.requiredSkills)) {
      const value = employee.skills?.[skill] ?? 0;
      if (value < min) reasons.push(`requires ${skill} >= ${min} (has ${value})`);
    }
  }

  if (rule.requiresAvailability && employee.available === false) {
    reasons.push(`${employee.id} is not available`);
  }

  return { eligible: reasons.length === 0, reasons };
}

/**
 * Locked Code Review rule:
 * - Senior and above (senior/lead/principal) may lead as primary.
 * - Intermediate may lead as primary only with a Senior+ secondary supervisor.
 * - Junior may participate only as secondary, never lead.
 * - Intern cannot participate.
 */
export const CODE_REVIEW_RULE: EligibilityRule = {
  activityId: "code-review",
  primaryLevels: ["senior", "lead", "principal"],
  secondaryLevels: ["junior", "intermediate", "senior", "lead", "principal"],
  supervisedPrimary: {
    level: "intermediate",
    supervisorLevels: ["senior", "lead", "principal"],
  },
};

export function evaluateCodeReview(
  employee: EmployeeSnapshot,
  kind: ParticipationKind,
  team: EmployeeSnapshot[] = [],
): EligibilityEvaluation {
  return evaluateEligibility(CODE_REVIEW_RULE, employee, kind, team);
}

export { isTechnicalAtLeast };
