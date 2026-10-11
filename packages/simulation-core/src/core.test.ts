import { describe, expect, it } from "vitest";
import {
  CALENDAR_DAYS_PER_MONTH,
  TICKS_PER_HOUR,
  WORKING_DAYS_PER_MONTH,
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
  formatDate,
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

describe("calendar (working-time clock)", () => {
  it("tick 0 is the START of Monday 09:00-09:15, month 1", () => {
    const c = getCalendar(0);
    expect(c.dayOfWeek).toBe(0);
    expect(c.isWorkingDay).toBe(true);
    expect(c.month).toBe(1);
    expect(c.weekInMonth).toBe(1);
    expect(c.workingDayInMonth).toBe(1);
    expect(c.dayInMonth).toBe(1);
    expect(c.totalWorkingDays).toBe(0);
    expect(c.totalCalendarDays).toBe(0);
    expect(formatTime(0)).toBe("09:00");
    expect(formatDate(0)).toBe("M1 W1 Mon 09:00");
  });
  it("every tick maps to working time (no night/weekend ticks)", () => {
    for (const t of [0, 31, 32, 159, 160, 639, 640, 1000]) {
      expect(isWorkingTick(t)).toBe(true);
      expect(getCalendar(t).dayOfWeek).toBeLessThan(5);
    }
  });
  it("a working month is 640 ticks = 20 working days on a 28-cell grid", () => {
    expect(countWorkingDays(640)).toBe(20);
    expect(countWorkingDays(639)).toBe(19);
    const c = getCalendar(640);
    expect(c.month).toBe(2);
    expect(c.weekInMonth).toBe(1);
    expect(c.workingDayInMonth).toBe(1);
    expect(c.dayInMonth).toBe(1);
    expect(c.totalCalendarDays).toBe(28);
    expect(CALENDAR_DAYS_PER_MONTH).toBe(28);
    expect(WORKING_DAYS_PER_MONTH).toBe(20);
  });
});

describe("working-time boundaries", () => {
  it("start of a working day is 09:00", () => {
    expect(formatTime(0)).toBe("09:00");
    expect(formatTime(32)).toBe("09:00");
    expect(getCalendar(32).dayOfWeek).toBe(1);
    expect(getCalendar(32).workingDayInMonth).toBe(2);
  });
  it("end of a working day is the start of the 16:45-17:00 interval", () => {
    expect(formatTime(31)).toBe("16:45");
    expect(getCalendar(31).dayOfWeek).toBe(0);
    expect(getCalendar(31).workingDayInMonth).toBe(1);
  });
  it("transitions from one working day to the next at the day boundary", () => {
    const last = getCalendar(31);
    const next = getCalendar(32);
    expect(last.minutesSinceMidnight).toBe(16 * 60 + 45);
    expect(next.minutesSinceMidnight).toBe(9 * 60);
    expect(next.dayOfWeek).toBe(last.dayOfWeek + 1);
    expect(next.totalWorkingDays).toBe(last.totalWorkingDays + 1);
    expect(next.totalCalendarDays).toBe(last.totalCalendarDays + 1);
  });
  it("Friday maps to the next Monday, skipping the weekend", () => {
    // Ticks 128-159 are Friday (5th working day); tick 160 is next Monday.
    expect(getCalendar(128).dayOfWeek).toBe(4);
    expect(formatDate(128)).toBe("M1 W1 Fri 09:00");
    expect(formatTime(159)).toBe("16:45");
    expect(getCalendar(159).dayOfWeek).toBe(4);
    const monday = getCalendar(160);
    expect(monday.dayOfWeek).toBe(0);
    expect(formatDate(160)).toBe("M1 W2 Mon 09:00");
    expect(monday.totalCalendarDays).toBe(7);
    // Friday is calendar day 5; Monday is calendar day 8 (6, 7 skipped).
    expect(getCalendar(159).dayInMonth).toBe(5);
    expect(monday.dayInMonth).toBe(8);
  });
  it("ends a working week at Friday 16:45", () => {
    const end = getCalendar(159);
    expect(end.weekInMonth).toBe(1);
    expect(end.workingDayInMonth).toBe(5);
    expect(getCalendar(160).weekInMonth).toBe(2);
    expect(getCalendar(160).workingDayInMonth).toBe(6);
  });
  it("transitions from tick 639 (month-end Friday 16:45) to tick 640 (new month Monday 09:00)", () => {
    const last = getCalendar(639);
    expect(formatDate(639)).toBe("M1 W4 Fri 16:45");
    expect(last.month).toBe(1);
    expect(last.weekInMonth).toBe(4);
    expect(last.workingDayInMonth).toBe(20);
    expect(last.totalWorkingDays).toBe(19);
    const next = getCalendar(640);
    expect(formatDate(640)).toBe("M2 W1 Mon 09:00");
    expect(next.month).toBe(2);
    expect(next.totalWorkingDays).toBe(20);
    expect(next.totalCalendarDays).toBe(28);
  });
  it("elapsed working ticks stay consistent with displayed calendar dates", () => {
    // Whole working days elapsed always equals floor(tick / 32).
    for (const t of [0, 1, 31, 32, 33, 160, 161, 639, 640, 641]) {
      expect(getCalendar(t).totalWorkingDays).toBe(Math.floor(t / 32));
      expect(countWorkingDays(t)).toBe(Math.floor(t / 32));
    }
    // Displayed time always falls inside 09:00-17:00 working hours.
    for (const t of [0, 15, 31, 32, 100, 159, 160, 639, 640]) {
      const c = getCalendar(t);
      expect(c.minutesSinceMidnight).toBeGreaterThanOrEqual(9 * 60);
      expect(c.minutesSinceMidnight).toBeLessThan(17 * 60);
      expect(c.minutesSinceMidnight % 15).toBe(0);
    }
    // Week/month numbers derive from working ticks: week = floor % 160, month = floor / 640.
    expect(getCalendar(320).weekInMonth).toBe(3);
    expect(getCalendar(480).weekInMonth).toBe(4);
    expect(getCalendar(1280).month).toBe(3);
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
