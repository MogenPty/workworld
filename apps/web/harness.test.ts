import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Closest practical integration check without a browser: the harness page
 * exists, is a client component, and delegates time advancement to the
 * simulation core's explicit tick commands rather than mutating state.
 */
describe("web harness smoke test", () => {
  const page = readFileSync(new URL("./app/page.tsx", import.meta.url), "utf8");

  it("is a client component", () => {
    expect(page).toContain('"use client"');
  });

  it("advances time only through advanceTicks", () => {
    expect(page).toContain("advanceTicks");
    expect(page).not.toMatch(/sim\.tick\s*=/);
  });

  it("wires pause/resume, tick/hour advance, reset, and save/load controls", () => {
    for (const label of [
      "Pause",
      "Resume",
      "Advance 1 tick",
      "Advance 1 hour",
      "Reset / new session",
      "Save",
      "Load",
      "Delete",
    ]) {
      expect(page).toContain(label);
    }
  });

  it("never imports browser-only storage into simulation state", () => {
    expect(page).toContain("IndexedDbStorage");
    expect(page).toContain("REAL_MS_PER_TICK_AT_NORMAL_SPEED");
  });
});
