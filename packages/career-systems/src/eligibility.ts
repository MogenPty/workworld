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

/**
 * An explicitly assigned participant and their role in the activity.
 * Supervision is satisfied only by assigned participants with role
 * "supervisor" or "secondary" — never by a general team roster.
 */
export interface AssignedParticipant {
  employee: EmployeeSnapshot;
  role: "primary" | "secondary" | "supervisor";
}

export interface EligibilityOptions {
  /**
   * Explicitly assigned supervisors for this activity instance. A Senior
   * merely appearing in the general `team` roster does NOT satisfy
   * supervision; pass assigned supervisors here (or use
   * `evaluateCodeReviewAssignment` with role-tagged participants).
   */
  supervisors?: EmployeeSnapshot[];
}

export function evaluateEligibility(
  rule: EligibilityRule,
  employee: EmployeeSnapshot,
  kind: ParticipationKind,
  team: EmployeeSnapshot[] = [],
  opts: EligibilityOptions = {},
): EligibilityEvaluation {
  void team;
  const reasons: string[] = [];
  const allowed = kind === "primary" ? rule.primaryLevels : rule.secondaryLevels;

  let levelOk = allowed.includes(employee.level);
  if (!levelOk && kind === "primary" && rule.supervisedPrimary && employee.level === rule.supervisedPrimary.level) {
    const supervisors = opts.supervisors ?? [];
    const supervisor = supervisors.find(
      (s) => s.id !== employee.id && rule.supervisedPrimary!.supervisorLevels.includes(s.level),
    );
    if (!supervisor) {
      reasons.push(
        `${employee.level} may lead ${rule.activityId} only with an assigned supervisor participating (${rule.supervisedPrimary.supervisorLevels.join("/")} as supervisor/secondary required)`,
      );
    } else if (rule.requiresAvailability && supervisor.available === false) {
      reasons.push(`assigned supervisor ${supervisor.id} is not available`);
    } else {
      levelOk = true;
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
 * - Intermediate may lead as primary only with a Senior+ supervisor
 *   explicitly assigned as supervisor/secondary participant.
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
  opts: EligibilityOptions = {},
): EligibilityEvaluation {
  return evaluateEligibility(CODE_REVIEW_RULE, employee, kind, team, opts);
}

/**
 * Evaluate a Code Review lead against role-tagged assigned participants.
 * Only participants with role "supervisor" or "secondary" count toward the
 * supervision requirement; roster membership without an assigned role does
 * not. (There is no task-allocation system yet — callers construct the
 * assignment list explicitly.)
 */
export function evaluateCodeReviewAssignment(
  lead: EmployeeSnapshot,
  participants: AssignedParticipant[],
  rule: EligibilityRule = CODE_REVIEW_RULE,
): EligibilityEvaluation {
  const supervisors = participants
    .filter((p) => p.role === "supervisor" || p.role === "secondary")
    .map((p) => p.employee);
  return evaluateEligibility(rule, lead, "primary", [], { supervisors });
}

export { isTechnicalAtLeast };
