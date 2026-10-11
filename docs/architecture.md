# WorkWorld — Architecture (Milestone 0.1)

Platform codename **WorkWorld**. Initial game codename **CodeWorks**.
Browser-based, single-player career and business simulation.
Milestone 0.1 delivers the simulation foundation + development harness only.

## Monorepo

pnpm workspaces, modular monolith.

| Package | Responsibility |
|---|---|
| `apps/web` | Next.js browser app + dev harness. Owns real-time pacing (tick scheduling), rendering, persistence wiring. |
| `packages/simulation-core` | Deterministic clock, tick advancement, seeded RNG, calendar. No React/Next/browser/DB imports. |
| `packages/career-systems` | Skills (0–100, 5 categories), traits, 8 career levels in 3 dimensions, reusable eligibility rules incl. Code Review. |
| `packages/game-sdk` | Typed contracts: `GameDefinition`, `GameMode`, `Scenario` + registries, validation, compatibility checks. |
| `packages/game-codeworks` | CodeWorks definition, Agile mode registration, default "First Day" scenario. |
| `packages/persistence` | Versioned save format, validation, migration boundary, `SaveStorage` interface, IndexedDB adapter, in-memory adapter for tests. |

Dependency direction: `simulation-core` ← `persistence`, `career-systems`, `game-sdk` ← `game-codeworks` ← `apps/web`.
The core never depends on the app, CodeWorks content, or browser APIs.

## Simulation clock (locked)

- 1 tick = 15 in-game minutes. Integer tick arithmetic only. A tick
  identifies the START of its interval (tick 0 = Monday 09:00-09:15).
- Normal speed: 1 real second = 5 in-game minutes → 1 tick = 3 real seconds.
- 1 hour = 4 ticks · 8h working day = 32 ticks · 5-day week = 160 ticks · 4-week month = 640 ticks.
- The clock advances only through scheduled working time (Mon–Fri,
  09:00–17:00). Overnight periods and weekends are skipped in the calendar
  mapping: tick 31 = Mon 16:45, tick 32 = Tue 09:00, tick 160 = next Monday
  09:00, tick 640 = next month Monday 09:00.
- Calendar: 4 weeks × 7 cells = 28-cell month grid; 20 working days/month
  (weekend cells skipped, so working ticks never display Sat/Sun).
- Tick 0 = Month 1, Week 1, Monday 09:00.
- Advancement is only via `advanceTicks(state, n)` with non-negative integer `n`.
- Identical (state, seed, commands) ⇒ identical resulting state.

## Determinism & seeded randomness

- `createRng(seed)` / `restoreRng(state)` — mulberry32 stream, pure function of
  `(seed, counter)`, O(1) restore, serializable `{seed, counter}` in saves.
- `advanceTicks` consumes one draw per tick so post-save/load continuation is exact.
- No unseeded randomness anywhere in the core (tested).

## Game definition / mode / scenario

Three separate concepts (`packages/game-sdk`):

- **GameDefinition**: identity, version, industry, supported skills/roles, extension points.
- **GameMode**: methodology + workflows for one way of operating (Agile registered;
  Waterfall/Kanban/Custom addable without core changes).
- **Scenario**: one playthrough's initial conditions, objectives, constraints;
  references a game id + compatible mode ids.

`checkCompatibility(game, mode, scenario)` validates the triple.
Sessions record game/mode/scenario ids + versions in state (`session`) and saves.

To add a mode: define a `GameMode` for `gameDefinitionId: "codeworks"`, register it,
reference it from scenarios via `compatibleModeIds`. To add a scenario: same pattern
with `startingTick/startingSeed/startingResources/objectives/constraints`.

## Persistence

Save format (`SAVE_SCHEMA_VERSION = 1`): schema version, game/mode/scenario ids +
versions, simulation `{tick, seed, rng, session, log}`, career `{skills, traits}`,
`savedAt` metadata. UI-only state is never persisted.

- `SaveStorage` interface: `save / load / list / delete`.
- `IndexedDbStorage` (browser) and `InMemoryStorage` (tests/fallback).
- Every load passes through `migrateSave` → `validateSaveData`.
- v1 reads only v1; anything else fails with an understandable error and the stored
  data is left untouched. Future versions add `migrateNtoM` functions at the
  migration boundary in `packages/persistence/src/save.ts`.

## Limitations / deferred (intentional)

No Agile gameplay, no Waterfall/Kanban/Custom, no isometric rendering (Phaser
deferred), no multiplayer/auth/remote DB/cloud sync, no progression economy,
no recruitment/meetings/projects/finances, no plugin architecture.
