# ADR-003 — Game definition, mode, and scenario as separate concepts

Status: accepted. Date: 2026-10-10.

Context: one engine must host many games, each with many modes and scenarios.
Decision: three distinct typed contracts in `packages/game-sdk` with explicit
`checkCompatibility` validation — never one merged config object. CodeWorks
ships one definition + one Agile mode + one default scenario as instances.
Consequences: adding Waterfall/Kanban/Custom or new scenarios needs no core
changes; incompatible triples fail loudly with reasons.
