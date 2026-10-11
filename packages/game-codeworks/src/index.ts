import { SKILL_CATALOG } from "@workworld/career-systems";
import type { GameDefinition, GameMode, Scenario } from "@workworld/game-sdk";

/**
 * CodeWorks: the initial software-industry career simulation game.
 * Full Agile gameplay is NOT implemented in Milestone 0.1 — only the
 * definition, one Agile mode registration, and one default scenario.
 */

export const CODEWORKS_DEFINITION: GameDefinition = {
  id: "codeworks",
  version: "0.1.0",
  name: "CodeWorks",
  codename: "CodeWorks",
  industry: "software",
  supportedSkillIds: SKILL_CATALOG.map((s) => s.id),
  supportedRoleIds: ["intern", "developer", "qa-engineer", "designer", "team-lead", "manager", "founder"],
  extensionPoints: ["career.progression", "delivery.workflow", "scenario.objectives"],
};

/**
 * Initial Agile mode. Registers methodology/workflows identity and a
 * config contract; gameplay behavior arrives in a later milestone.
 * Waterfall / Kanban / Custom are intentionally absent but addable
 * without touching the simulation core.
 */
export const AGILE_MODE: GameMode = {
  id: "agile",
  version: "0.1.0",
  gameDefinitionId: "codeworks",
  name: "Agile",
  description: "Iterative delivery in sprints with reviews and retros (gameplay deferred).",
  config: {
    methodology: "agile",
    sprintLengthWeeks: 2,
    ceremonies: ["planning", "daily-standup", "review", "retrospective"],
  },
};

/** Minimal playable-default scenario with starting conditions. */
export const DEFAULT_SCENARIO: Scenario = {
  id: "first-day",
  version: "0.1.0",
  gameDefinitionId: "codeworks",
  compatibleModeIds: ["agile"],
  name: "First Day",
  description: "A new junior hire starts at a small software studio.",
  startingTick: 0,
  startingSeed: 20261010,
  startingResources: { funds: 1000, energy: 100, reputation: 0 },
  startingSkills: { programming: 25, debugging: 20, communication: 30, testing: 15 },
  startingTraits: { diligence: 60, creativity: 55, sociability: 50, adaptability: 60, "leadership-affinity": 40 },
  objectives: [
    { id: "settle-in", description: "Complete your first working day (32 ticks)." },
    { id: "first-review", description: "Observe a supervised code review." },
  ],
  constraints: [
    { id: "work-hours", description: "Work is scheduled on Mon-Fri working days only." },
  ],
} as Scenario & {
  startingSkills: Record<string, number>;
  startingTraits: Record<string, number>;
};

export function registerAnotherModeNote(): string {
  return [
    "To register another mode (e.g. Kanban):",
    "1. Define a GameMode with id, version, gameDefinitionId 'codeworks'.",
    "2. Register it in a Registry<GameMode> alongside AGILE_MODE.",
    "3. Reference it from new scenarios via compatibleModeIds.",
    "No simulation-core changes are needed.",
  ].join("\n");
}
