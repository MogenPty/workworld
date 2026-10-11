"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REAL_MS_PER_TICK_AT_NORMAL_SPEED,
  TICKS_PER_HOUR,
  WORK_TICKS_PER_DAY,
  advanceTicks,
  countWorkingDays,
  createSimulation,
  formatDate,
  formatTime,
  getCalendar,
  type SimulationState,
} from "@workworld/simulation-core";
import { createSkillSet, createTraitSet } from "@workworld/career-systems";
import { checkCompatibility } from "@workworld/game-sdk";
import {
  AGILE_MODE,
  CODEWORKS_DEFINITION,
  DEFAULT_SCENARIO,
} from "@workworld/game-codeworks";
import {
  IndexedDbStorage,
  InMemoryStorage,
  createSaveData,
  restoreSimulation,
  type SaveStorage,
} from "@workworld/persistence";

const SCENARIO_DEFAULTS = DEFAULT_SCENARIO as unknown as {
  startingSkills: Record<string, number>;
  startingTraits: Record<string, number>;
};

function newSessionState() {
  return createSimulation({
    seed: DEFAULT_SCENARIO.startingSeed,
    startingTick: DEFAULT_SCENARIO.startingTick,
    session: {
      gameDefinitionId: CODEWORKS_DEFINITION.id,
      gameDefinitionVersion: CODEWORKS_DEFINITION.version,
      modeId: AGILE_MODE.id,
      modeVersion: AGILE_MODE.version,
      scenarioId: DEFAULT_SCENARIO.id,
      scenarioVersion: DEFAULT_SCENARIO.version,
    },
  });
}

type Feedback = { kind: "success" | "error"; message: string } | null;

export default function HarnessPage() {
  const [sim, setSim] = useState<SimulationState>(() => newSessionState());
  const [skills] = useState(() => createSkillSet(SCENARIO_DEFAULTS.startingSkills ?? {}));
  const [traits] = useState(() => createTraitSet(SCENARIO_DEFAULTS.startingTraits ?? {}));
  const [running, setRunning] = useState(false);
  const [saveName, setSaveName] = useState("dev-save-1");
  const [saves, setSaves] = useState<Array<{ name: string; savedAt: string }>>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Lazily created once via state initializer: no ref mutation during render
  // (render-safe under React 19 / React Compiler rules).
  const [storage] = useState<SaveStorage>(() => {
    try {
      return new IndexedDbStorage();
    } catch {
      return new InMemoryStorage();
    }
  });
  const storageNote =
    storage instanceof IndexedDbStorage ? "IndexedDB" : "in-memory fallback (IndexedDB unavailable)";

  const refreshSaves = useCallback(async () => {
    try {
      setSaves(await storage.list());
    } catch (err) {
      setFeedback({ kind: "error", message: `List saves failed: ${messageOf(err)}` });
    }
  }, [storage]);

  // Initial async load from the external save store (IndexedDB) on mount:
  // synchronizing React state with an external system, not derived state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch from external store
    void refreshSaves();
  }, [refreshSaves]);

  // Automatic advancement at normal speed: 1 tick per 3 real seconds.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSim((prev) => advanceTicks(prev, 1));
    }, REAL_MS_PER_TICK_AT_NORMAL_SPEED);
    return () => clearInterval(id);
  }, [running]);

  const cal = useMemo(() => getCalendar(sim.tick), [sim.tick]);
  const compatibility = useMemo(
    () => checkCompatibility(CODEWORKS_DEFINITION, AGILE_MODE, DEFAULT_SCENARIO),
    [],
  );

  const flash = (kind: "success" | "error", message: string) => setFeedback({ kind, message });

  const handleSave = async () => {
    try {
      await storage.save(
        createSaveData({
          name: saveName.trim() || "dev-save-1",
          gameDefinitionId: CODEWORKS_DEFINITION.id,
          gameDefinitionVersion: CODEWORKS_DEFINITION.version,
          modeId: AGILE_MODE.id,
          modeVersion: AGILE_MODE.version,
          scenarioId: DEFAULT_SCENARIO.id,
          scenarioVersion: DEFAULT_SCENARIO.version,
          simulation: sim,
          career: { skills, traits },
        }),
      );
      await refreshSaves();
      flash("success", `Saved "${saveName}" at tick ${sim.tick}.`);
    } catch (err) {
      flash("error", `Save failed: ${messageOf(err)}`);
    }
  };

  const handleLoad = async (name: string) => {
    try {
      const loaded = await storage.load(name);
      setSim(restoreSimulation(loaded));
      setRunning(false);
      flash("success", `Loaded "${name}" at tick ${loaded.simulation.tick}.`);
    } catch (err) {
      flash("error", `Load failed: ${messageOf(err)}`);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await storage.delete(name);
      await refreshSaves();
      flash("success", `Deleted save "${name}".`);
    } catch (err) {
      flash("error", `Delete failed: ${messageOf(err)}`);
    }
  };

  const card: React.CSSProperties = {
    background: "#1a2233",
    border: "1px solid #2c3a55",
    borderRadius: 8,
    padding: 16,
  };
  const button: React.CSSProperties = {
    background: "#2f6df6",
    color: "white",
    border: 0,
    borderRadius: 6,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 14,
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ margin: "0 0 4px" }}>WorkWorld — CodeWorks Dev Harness</h1>
        <p style={{ margin: 0, color: "#9fb0cc" }}>
          Platform codename <strong>WorkWorld</strong> · Game codename <strong>CodeWorks</strong> ·
          internal development screen (Milestone 0.1).
        </p>
      </header>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Session configuration</h2>
        <p>Game: {CODEWORKS_DEFINITION.name} ({CODEWORKS_DEFINITION.id}@{CODEWORKS_DEFINITION.version})</p>
        <p>Mode: {AGILE_MODE.name} ({AGILE_MODE.id}@{AGILE_MODE.version})</p>
        <p>Scenario: {DEFAULT_SCENARIO.name} ({DEFAULT_SCENARIO.id}@{DEFAULT_SCENARIO.version})</p>
        <p>
          Compatibility:{" "}
          {compatibility.compatible ? (
            <span style={{ color: "#7ee2a8" }}>valid</span>
          ) : (
            <span style={{ color: "#ff9d9d" }}>{compatibility.reasons.join("; ")}</span>
          )}
        </p>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Simulation clock</h2>
        <p style={{ fontSize: 20 }}>
          <strong>{formatDate(sim.tick)}</strong> · tick {sim.tick}
        </p>
        <p>
          Time {formatTime(sim.tick)} · working day {cal.workingDayInMonth || "—"}/20 · week{" "}
          {cal.weekInMonth}/4 · month {cal.month} · working days elapsed {countWorkingDays(sim.tick)} ·{" "}
          {cal.isWorkingDay ? "working day" : "weekend (no work scheduled)"}
        </p>
        <p style={{ color: "#9fb0cc" }}>
          Status: {running ? "running (1 tick / 3s, normal speed)" : "paused"} · seed {sim.seed}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={button} onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Resume"}
          </button>
          <button style={button} onClick={() => setSim((s) => advanceTicks(s, 1))}>
            Advance 1 tick
          </button>
          <button style={button} onClick={() => setSim((s) => advanceTicks(s, TICKS_PER_HOUR))}>
            Advance 1 hour ({TICKS_PER_HOUR} ticks)
          </button>
          {!confirmingReset ? (
            <button style={{ ...button, background: "#8a3b3b" }} onClick={() => setConfirmingReset(true)}>
              Reset / new session
            </button>
          ) : (
            <>
              <button
                style={{ ...button, background: "#8a3b3b" }}
                onClick={() => {
                  setSim(newSessionState());
                  setRunning(false);
                  setConfirmingReset(false);
                  flash("success", "New session started from the default scenario.");
                }}
              >
                Confirm reset
              </button>
              <button style={{ ...button, background: "#3a4358" }} onClick={() => setConfirmingReset(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
        <p style={{ color: "#9fb0cc", fontSize: 13 }}>
          One 8h working day = {WORK_TICKS_PER_DAY} ticks. UI schedules ticks in real time; the simulation
          core advances only on explicit tick commands.
        </p>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Persistence ({storageNote})</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            aria-label="Save name"
            style={{ padding: 8, borderRadius: 6, border: "1px solid #2c3a55", background: "#0f1420", color: "inherit" }}
          />
          <button style={button} onClick={handleSave}>Save</button>
          <button style={button} onClick={() => void refreshSaves()}>Refresh list</button>
        </div>
        {saves.length === 0 ? (
          <p style={{ color: "#9fb0cc" }}>No saves yet.</p>
        ) : (
          <ul>
            {saves.map((s) => (
              <li key={s.name} style={{ marginBottom: 6 }}>
                {s.name} <span style={{ color: "#9fb0cc" }}>({s.savedAt})</span>{" "}
                <button style={button} onClick={() => void handleLoad(s.name)}>Load</button>{" "}
                <button style={{ ...button, background: "#8a3b3b" }} onClick={() => void handleDelete(s.name)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {feedback && (
          <p style={{ color: feedback.kind === "success" ? "#7ee2a8" : "#ff9d9d" }}>{feedback.message}</p>
        )}
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Career readout</h2>
        <h3>Skills</h3>
        <ul style={{ columns: 2 }}>
          {Object.entries(skills).map(([id, value]) => (
            <li key={id}>{id}: {value}</li>
          ))}
        </ul>
        <h3>Traits</h3>
        <ul style={{ columns: 2 }}>
          {Object.entries(traits).map(([id, value]) => (
            <li key={id}>{id}: {value}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
