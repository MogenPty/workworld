# ADR-002 — Deterministic TypeScript simulation core separated from UI

Status: accepted. Date: 2026-10-10.

Context: game outcomes must be reproducible, testable, and resumable.
Decision: `packages/simulation-core` is pure TypeScript with integer tick
arithmetic and seeded randomness; it imports nothing from React, Next.js,
Phaser, browser APIs, or databases (enforced by test). The UI schedules
ticks in real time but the core advances only on explicit `advanceTicks`.
Consequences: core tests run in Node without a browser; save/load
continuation is exact; wall-clock bugs cannot leak into game outcomes.
