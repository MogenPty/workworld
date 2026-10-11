import { describe, expect, it } from "vitest";
import {
  TICKS_PER_HOUR,
  WORK_TICKS_PER_DAY,
  WORK_TICKS_PER_WEEK,
  WORK_TICKS_PER_MONTH,
  TICK_MINUTES,
  REAL_MS_PER_TICK_AT_NORMAL_SPEED,
  ticksToMinutes,
  ticksToHours,
  ticksToWorkingDays,
  workingDaysToTicks,
  workingWeeksToTicks,
  getCalendar,
  isWorkingTick,
  countWorkingDays,
  formatTime,
} from "./clock";
import { createSimulation, advanceTicks } from "./simulation";
import { createRng, restoreRng } from "./rng";

describe("clock locked rules", () => {
  it("one tick = 15 minutes, hour = 4 ticks", () => {
    expect(TICK_MINUTES).toBe(15);
    expect(TICKS_PER_HOUR).toBe(4);
    expect(ticksToMinutes(1)).toBe(15);
    expect(ticksToHours(4)).toBe(1);
  });
  it("normal speed: 1 tick = 3 real seconds", () => {
    expect(REAL_MS_PER_TICK_AT_NORMAL_SPEED).toBe(3000);
  });
  it("working day = 32, week = 160, month = 640", () => {
    expect(WORK_TICKS_PER_DAY).toBe(32);
    expect(WORK_TICKS_PER_WEEK).toBe(160);
    expect(WORK_TICKS_PER_MONTH).toBe(640);
    expect(ticksToWorkingDays(32)).toBe(1);
    expect(workingDaysToTicks(5)).toBe(160);
    expect(workingWeeksToTicks(4)).toBe(640);
  });
  it("rejects non-integer or negative ticks", () => {
    expect(() => ticksToMinutes(-1)).toThrow(RangeError);
    expect(() => ticksToMinutes(1.5)).toThrow(RangeError);
    expect(() => advanceTicks(createSimulation({ seed: 1 }), -1)).toThrow(RangeError);
    expect(() => advanceTicks(createSimulation({ seed: 1 }), 0.5)).toThrow(RangeError);
  });
});

describe("calendar", () => {
  it("tick 0 starts Monday 09:00 of month 1", () => {
    const c = getCalendar(0);
    expect(c.dayOfWeek).toBe(0);
    expect(c.isWorkingDay).toBe(true);
    expect(c.month).toBe(1);
    expect(formatTime(0)).toBe("09:00");
  });
  it("marks weekends as non-working", () => {
    // Monday 09:00 + 5 calendar days => Saturday.
    const saturdayTick = 5 * 96;
    expect(getCalendar(saturdayTick).dayOfWeek).toBe(5);
    expect(isWorkingTick(saturdayTick)).toBe(false);
    expect(isWorkingTick(0)).toBe(true);
  });
  it("counts 20 working days per 4-week month", () => {
    // 28 calendar days = 2688 ticks.
    expect(countWorkingDays(28 * 96)).toBe(20);
    expect(getCalendar(28 * 96).month).toBe(2);
  });
});

describe("deterministic advancement", () => {
  it("identical initial state + ticks => identical state", () => {
    const a = advanceTicks(createSimulation({ seed: 42 }), 100);
    const b = advanceTicks(createSimulation({ seed: 42 }), 100);
    expect(a).toEqual(b);
  });
  it("split advancement equals single advancement", () => {
    const direct = advanceTicks(createSimulation({ seed: 7 }), 50);
    const split = advanceTicks(advanceTicks(createSimulation({ seed: 7 }), 20), 30);
    expect(split).toEqual(direct);
  });
});

describe("seeded rng", () => {
  it("same seed => same sequence", () => {
    const a = createRng(123);
    const b = createRng(123);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it("different seeds diverge", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });
  it("restore continues exactly", () => {
    const a = createRng(99);
    const first = a.next();
    const state = a.getState();
    const continued = a.next();
    const restored = restoreRng(state);
    expect(restored.next()).toBe(continued);
    expect(first).not.toBe(continued);
  });
  it("never uses Math.random (state-driven only)", () => {
    const a = createRng(5, 1000);
    const b = restoreRng({ seed: 5, counter: 1000 });
    expect(a.next()).toBe(b.next());
  });
});
