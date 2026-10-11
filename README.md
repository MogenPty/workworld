# WorkWorld (Milestone 0.1 — Simulation Foundation)

Platform codename **WorkWorld** · game codename **CodeWorks**.
Single-player, browser-based career/business simulation. This milestone is the
deterministic simulation foundation + a Next.js development harness.

## Tooling

- Node.js 20+ (tested with Node 26), pnpm 9.
- TypeScript 5.9, Next.js 16 + React 19, Vitest 5, Vite 8, ESLint 10 (flat config).

## Setup

```powershell
pnpm install
```

## Run the browser harness

```powershell
pnpm dev
# open http://localhost:3000
```

Controls: pause/resume (1 tick / 3s at normal speed), advance 1 tick, advance
1 hour (4 ticks), reset/new-session (with confirm), save/load/list/delete with
feedback, skills + traits readout.

## Checks

```powershell
pnpm test        # all workspace tests
pnpm typecheck   # tsc --noEmit per package
pnpm build       # per-package build (web: next build)
pnpm lint       # per-package lint
```

## Structure & rules

See `docs/architecture.md` and `docs/decisions/`. Short version: integer ticks
(1 tick = 15 min), explicit `advanceTicks`, seeded RNG, game/mode/scenario as
separate contracts, versioned IndexedDB saves, core free of UI/browser imports.

## Deferred

Agile gameplay, other modes/games, Phaser/isometric office, multiplayer, auth,
remote DB/cloud sync, progression economy, recruitment, meetings, finances.
