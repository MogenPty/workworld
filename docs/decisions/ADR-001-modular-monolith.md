# ADR-001 — Modular monolith, not microservices

Status: accepted. Date: 2026-10-10.

Context: single-player browser simulation, small team, first milestone.
Decision: one pnpm-workspace monorepo with clear package boundaries and a
one-way dependency direction. No separately deployed services.
Consequences: simple reproducible installs, fast refactors, no network
boundaries to version. Revisit only if a genuinely independent deployable
(service multiplayer/sync) is approved.
