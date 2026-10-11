import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const src = new URL("./", import.meta.url);

describe("simulation-core independence", () => {
  const files = readdirSync(src).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  it("core sources avoid UI/browser/database imports", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(new URL(`./${file}`, src), "utf8");
      const lower = content.toLowerCase();
      const imports = content
        .split("\n")
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n")
        .toLowerCase();
      for (const token of ["react", "next", "phaser"]) {
        expect(imports, `${file} must not import ${token}`).not.toContain(token);
      }
      for (const token of ["indexeddb", "localstorage", "math.random("]) {
        expect(lower, `${file} must not reference ${token}`).not.toContain(token);
      }
    }
  });
});
