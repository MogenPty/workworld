# ADR-004 — Browser-first, local-first persistence

Status: accepted. Date: 2026-10-10.

Context: single-player dev harness; no server approved.
Decision: versioned saves in browser IndexedDB behind a UI/storage-independent
`SaveStorage` interface; every load validated with a migration boundary that
rejects unknown versions loudly instead of reinterpreting them.
Consequences: works offline, no backend to operate; future sync (if approved)
implements `SaveStorage` without touching the core.
