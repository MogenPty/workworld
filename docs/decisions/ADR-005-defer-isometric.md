# ADR-005 — Defer isometric rendering to a later milestone

Status: accepted. Date: 2026-10-10.

Context: milestone 0.1 must prove the simulation foundation first.
Decision: no Phaser, no isometric office, no movement/character art in 0.1.
The harness is plain React verifying clock, content, and persistence.
Consequences: smaller dependency surface, faster iteration; rendering
milestone builds on tested contracts instead of coupling to them early.
