/**
 * Locked simulation clock rules (Milestone 0.1).
 *
 * - 1 tick = 15 in-game minutes.
 * - Normal speed: 1 real second = 5 in-game minutes, so 1 tick = 3 real seconds.
 * - 1 in-game hour = 4 ticks.
 * - 1 eight-hour working day = 32 ticks.
 * - 1 five-day working week = 160 ticks.
 * - 1 four-week game month = 640 ticks.
 *
 * All arithmetic uses integers. No floating point accumulation.
 *
 * Calendar model: the game month is 4 weeks of 7 calendar days (28 days),
 * of which Monday-Friday are working days (20 working days). The clock
 * advances uniformly through nights and weekends; scheduling layers must
 * consult `isWorkingDay` / `isWorkingTick` and skip non-working periods
 * explicitly rather than assuming every tick is work time.
 */

export const TICK_MINUTES = 15;
export const TICKS_PER_HOUR = 4;
export const WORK_HOURS_PER_DAY = 8;
export const WORK_TICKS_PER_DAY = 32;
export const WORK_DAYS_PER_WEEK = 5;
export const WORK_TICKS_PER_WEEK = 160;
export const WEEKS_PER_MONTH = 4;
export const WORK_TICKS_PER_MONTH = 640;

/** Real-time pacing for the application layer only (never the core). */
export const REAL_SECONDS_PER_TICK_AT_NORMAL_SPEED = 3;
export const REAL_MS_PER_TICK_AT_NORMAL_SPEED = 3000;

export const CALENDAR_DAYS_PER_WEEK = 7;
export const CALENDAR_WEEKS_PER_MONTH = 4;
export const CALENDAR_DAYS_PER_MONTH = 28;

/** Ticks in a full 24h calendar day (96) — includes non-working hours. */
export const TICKS_PER_CALENDAR_DAY = 96;

export function ticksToMinutes(ticks: number): number {
  assertNonNegativeInteger(ticks, "ticks");
  return ticks * TICK_MINUTES;
}

export function minutesToWholeTicks(minutes: number): number {
  assertNonNegativeInteger(minutes, "minutes");
  return Math.floor(minutes / TICK_MINUTES);
}

export function ticksToHours(ticks: number): number {
  assertNonNegativeInteger(ticks, "ticks");
  return ticks / TICKS_PER_HOUR;
}

/** Whole working days (8h) contained in a tick count. */
export function ticksToWorkingDays(ticks: number): number {
  assertNonNegativeInteger(ticks, "ticks");
  return Math.floor(ticks / WORK_TICKS_PER_DAY);
}

export function workingDaysToTicks(days: number): number {
  assertNonNegativeInteger(days, "days");
  return days * WORK_TICKS_PER_DAY;
}

export function workingWeeksToTicks(weeks: number): number {
  assertNonNegativeInteger(weeks, "weeks");
  return weeks * WORK_TICKS_PER_WEEK;
}

export interface CalendarInfo {
  /** Total whole calendar days elapsed since tick 0. */
  totalCalendarDays: number;
  /** 1-based month number. */
  month: number;
  /** 1-based week number within the month (1-4). */
  weekInMonth: number;
  /** 1-based day number within the month (1-28). */
  dayInMonth: number;
  /** 0=Monday .. 6=Sunday. Tick 0 is a Monday. */
  dayOfWeek: number;
  isWorkingDay: boolean;
  /** Whole working days elapsed (Mon-Fri only). */
  totalWorkingDays: number;
  /** 1-based working-day number within the month (1-20), 0 on weekends. */
  workingDayInMonth: number;
  /** Minutes since midnight for the current tick (tick 0 starts at 09:00). */
  minutesSinceMidnight: number;
  hours: number;
  minutes: number;
}

const START_MINUTES_SINCE_MIDNIGHT = 9 * 60;

export function getCalendar(tick: number): CalendarInfo {
  assertNonNegativeInteger(tick, "tick");
  const absoluteMinutes = START_MINUTES_SINCE_MIDNIGHT + tick * TICK_MINUTES;
  const totalCalendarDays = Math.floor(absoluteMinutes / 1440);
  const minutesSinceMidnight = absoluteMinutes % 1440;
  const dayOfWeek = totalCalendarDays % 7; // 0 = Monday
  const isWorkingDay = dayOfWeek < 5;
  const month = Math.floor(totalCalendarDays / CALENDAR_DAYS_PER_MONTH) + 1;
  const dayInMonth = (totalCalendarDays % CALENDAR_DAYS_PER_MONTH) + 1;
  const weekInMonth = Math.floor((dayInMonth - 1) / 7) + 1;

  // Count working days elapsed in [0, totalCalendarDays).
  const fullMonths = Math.floor(totalCalendarDays / CALENDAR_DAYS_PER_MONTH);
  let totalWorkingDays = fullMonths * 20;
  const remainder = totalCalendarDays % CALENDAR_DAYS_PER_MONTH;
  for (let d = 0; d < remainder; d++) {
    if (d % 7 < 5) totalWorkingDays += 1;
  }
  let workingDayInMonth = 0;
  if (isWorkingDay) {
    let count = 0;
    for (let d = 0; d < dayInMonth; d++) {
      if (d % 7 < 5) count += 1;
    }
    workingDayInMonth = count;
  }

  return {
    totalCalendarDays,
    month,
    weekInMonth,
    dayInMonth,
    dayOfWeek,
    isWorkingDay,
    totalWorkingDays,
    workingDayInMonth,
    minutesSinceMidnight,
    hours: Math.floor(minutesSinceMidnight / 60),
    minutes: minutesSinceMidnight % 60,
  };
}

/** True when the calendar day of `tick` is Mon-Fri. Time of day is not filtered. */
export function isWorkingTick(tick: number): boolean {
  return getCalendar(tick).isWorkingDay;
}

/** Count of Mon-Fri working days fully covered by the first `ticks` ticks. */
export function countWorkingDays(ticks: number): number {
  assertNonNegativeInteger(ticks, "ticks");
  return getCalendar(ticks).totalWorkingDays;
}

export function formatTime(tick: number): string {
  const c = getCalendar(tick);
  const hh = String(c.hours).padStart(2, "0");
  const mm = String(c.minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function formatDate(tick: number): string {
  const c = getCalendar(tick);
  return `M${c.month} W${c.weekInMonth} ${DAY_NAMES[c.dayOfWeek]} ${formatTime(tick)}`;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}
