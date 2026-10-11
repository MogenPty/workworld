import { describe, expect, it } from "vitest";
import {
  SKILL_CATALOG,
  SKILL_MAX,
  SKILL_MIN,
  createSkillSet,
  validateSkillSet,
  validateSkillValue,
} from "./skills";
import { CAREER_LEVELS, careerDimension, isTechnicalAtLeast } from "./levels";
import { createTraitSet } from "./traits";
import { evaluateCodeReview, evaluateCodeReviewAssignment, evaluateEligibility, CODE_REVIEW_RULE } from "./eligibility";

describe("skills", () => {
  it("bounds are 0..100", () => {
    expect(SKILL_MIN).toBe(0);
    expect(SKILL_MAX).toBe(100);
    expect(() => validateSkillValue(-1)).toThrow(RangeError);
    expect(() => validateSkillValue(101)).toThrow(RangeError);
    expect(() => validateSkillValue(1.5)).toThrow(RangeError);
    expect(() => validateSkillValue(NaN)).toThrow(RangeError);
  });
  it("catalog covers all five required categories", () => {
    const cats = new Set(SKILL_CATALOG.map((s) => s.category));
    expect(cats).toEqual(
      new Set([
        "technical-engineering",
        "quality-engineering",
        "product-design",
        "agile-delivery-leadership",
        "business-management",
      ]),
    );
  });
  it("catalog includes agreed examples", () => {
    const ids = SKILL_CATALOG.map((s) => s.id);
    for (const id of [
      "programming", "debugging", "software-design", "architecture", "databases",
      "apis", "version-control", "devops", "security", "testing", "ui-ux",
      "estimation", "communication", "mentoring", "sales", "finance", "client-management",
    ]) {
      expect(ids).toContain(id);
    }
  });
  it("rejects unknown skills and out-of-range sets", () => {
    expect(() => createSkillSet({ nope: 10 })).toThrow();
    expect(() => createSkillSet({ programming: 200 })).toThrow();
    expect(validateSkillSet({ programming: -1 }).length).toBeGreaterThan(0);
    expect(validateSkillSet(createSkillSet({ programming: 42 }))).toEqual([]);
  });
});

describe("traits", () => {
  it("defaults to neutral and validates bounds", () => {
    const t = createTraitSet();
    expect(t["diligence"]).toBe(50);
    expect(() => createTraitSet({ diligence: 101 })).toThrow();
    expect(() => createTraitSet({ unknown: 10 })).toThrow();
  });
});

describe("career levels", () => {
  it("represents all eight levels explicitly", () => {
    expect(CAREER_LEVELS).toHaveLength(8);
    expect(CAREER_LEVELS).toContain("business-owner");
  });
  it("models three distinct dimensions, not one ladder", () => {
    expect(careerDimension("senior")).toBe("technical");
    expect(careerDimension("principal")).toBe("technical");
    expect(careerDimension("manager")).toBe("management");
    expect(careerDimension("business-owner")).toBe("business");
    expect(isTechnicalAtLeast("manager", "senior")).toBe(false);
    expect(isTechnicalAtLeast("lead", "senior")).toBe(true);
  });
});

describe("code review eligibility", () => {
  const senior = { id: "s", level: "senior" as const };
  const intermediate = { id: "i", level: "intermediate" as const };
  const junior = { id: "j", level: "junior" as const };
  const intern = { id: "n", level: "intern" as const };

  it("senior+ can lead as primary", () => {
    expect(evaluateCodeReview(senior, "primary").eligible).toBe(true);
    expect(evaluateCodeReview({ id: "l", level: "lead" }, "primary").eligible).toBe(true);
  });
  it("a senior on the general roster does not satisfy supervision by itself", () => {
    // Roster membership without an explicit supervisor assignment is insufficient.
    const r = evaluateCodeReview(intermediate, "primary", [senior]);
    expect(r.eligible).toBe(false);
    expect(evaluateCodeReview(intermediate, "primary", []).eligible).toBe(false);
  });
  it("unassigned supervisor fails", () => {
    const r = evaluateCodeReviewAssignment(intermediate, [
      { employee: junior, role: "secondary" },
    ]);
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(";")).toContain("supervisor");
  });
  it("valid supervision passes via supervisor or secondary role", () => {
    expect(
      evaluateCodeReview(intermediate, "primary", [], { supervisors: [senior] }).eligible,
    ).toBe(true);
    expect(
      evaluateCodeReviewAssignment(intermediate, [{ employee: senior, role: "supervisor" }]).eligible,
    ).toBe(true);
    expect(
      evaluateCodeReviewAssignment(intermediate, [{ employee: senior, role: "secondary" }]).eligible,
    ).toBe(true);
  });
  it("unavailable supervisor fails when availability is required", () => {
    const rule = { ...CODE_REVIEW_RULE, requiresAvailability: true };
    const busy = { id: "s", level: "senior" as const, available: false };
    const r = evaluateEligibility(rule, intermediate, "primary", [], { supervisors: [busy] });
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(";")).toContain("not available");
    // An available supervisor passes under the same rule.
    const ok = evaluateEligibility(rule, intermediate, "primary", [], { supervisors: [senior] });
    expect(ok.eligible).toBe(true);
  });
  it("junior is secondary-only, even with supervision", () => {
    expect(evaluateCodeReview(junior, "primary", [senior]).eligible).toBe(false);
    expect(
      evaluateCodeReview(junior, "primary", [], { supervisors: [senior] }).eligible,
    ).toBe(false);
    expect(
      evaluateCodeReviewAssignment(junior, [{ employee: senior, role: "supervisor" }]).eligible,
    ).toBe(false);
    expect(evaluateCodeReview(junior, "secondary").eligible).toBe(true);
  });
  it("intern cannot participate", () => {
    expect(evaluateCodeReview(intern, "primary").eligible).toBe(false);
    expect(evaluateCodeReview(intern, "secondary").eligible).toBe(false);
  });
  it("normal senior-led review with juniors participating", () => {
    expect(evaluateCodeReview(senior, "primary").eligible).toBe(true);
    expect(evaluateCodeReview(junior, "secondary").eligible).toBe(true);
    expect(evaluateCodeReview(intermediate, "secondary").eligible).toBe(true);
  });
});
