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
 * Tick semantics: a tick identifies the START of its 15-minute interval.
 * Tick 0 is Monday 09:00 (the start of the first interval, 09:00-09:15).
 * The clock advances only through scheduled working time (Mon-Fri,
 * 09:00-17:00). Overnight periods and weekends are skipped in the calendar
 * mapping: the tick after the last interval of a working day
 * (e.g. tick 31 = Monday 16:45-17:00) is the start of the next working
 * period (e.g. tick 32 = Tuesday 09:00), and the tick after Friday 16:45
 * is the following Monday 09:00. Every tick therefore maps to working
 * time; there are no ticks at night or on weekends.
 *
 * Consequences:
 * - `getCalendar(t)` displays the working date/time for the start of
 *   tick `t`'s interval.
 * - `countWorkingDays(n)` = floor(n / 32): whole working days fully
 *   covered by the first `n` ticks. `getCalendar(t).totalWorkingDays` is
 *   the same quantity for elapsed tick count `t`.
 * - Month `m` covers working ticks [(m-1)*640, m*640), i.e. 20 working
 *   days displayed on a 28-cell calendar grid (weekends skipped).
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

/** Working hours: intervals start at 09:00 up to (excluding) 17:00. */
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 17;
export const WORK_START_MINUTES_SINCE_MIDNIGHT = WORK_START_HOUR * 60;

/** Calendar grid the working month is displayed on (weekends skipped). */
export const CALENDAR_DAYS_PER_WEEK = 7;
export const CALENDAR_WEEKS_PER_MONTH = 4;
export const CALENDAR_DAYS_PER_MONTH = 28;
/** Working days displayed per game month (Mon-Fri x 4 weeks). */
export const WORKING_DAYS_PER_MONTH = 20;

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
  /**
   * Calendar days elapsed since the Monday of week 1, counting skipped
   * weekend days: 5 working days + 2 weekend days per working week.
   * Tick 0 (Mon 09:00) => 0; tick 32 (Tue 09:00) => 1; tick 160
   * (next Monday 09:00) => 7; tick 640 (next month Monday) => 28.
   */
  totalCalendarDays: number;
  /** 1-based month number. Month m covers ticks [(m-1)*640, m*640). */
  month: number;
  /** 1-based week number within the month (1-4). */
  weekInMonth: number;
  /**
   * 1-based calendar day number within the month on the 28-cell grid
   * (1-28, weekend cells skipped so working ticks never land on 6, 7,
   * 13, 14, 20, 21, 27, 28).
   */
  dayInMonth: number;
  /** 0=Monday .. 4=Friday. Every tick maps to a working day. */
  dayOfWeek: number;
  /** Always true: the working-time clock has no night/weekend ticks. */
  isWorkingDay: boolean;
  /** Whole working days completed before this tick (= floor(tick / 32)). */
  totalWorkingDays: number;
  /** 1-based working-day number within the month (1-20). */
  workingDayInMonth: number;
  /** Minutes since midnight for the START of this tick's interval. */
  minutesSinceMidnight: number;
  hours: number;
  minutes: number;
}

export function getCalendar(tick: number): CalendarInfo {
  assertNonNegativeInteger(tick, "tick");
  const tickInDay = tick % WORK_TICKS_PER_DAY;
  const minutesSinceMidnight = WORK_START_MINUTES_SINCE_MIDNIGHT + tickInDay * TICK_MINUTES;

  // Working-day arithmetic (authoritative).
  const workingDayIndex = Math.floor(tick / WORK_TICKS_PER_DAY); // 0-based
  const totalWorkingDays = workingDayIndex;
  const dayOfWeek = workingDayIndex % WORK_DAYS_PER_WEEK; // 0 = Monday
  const isWorkingDay = true;

  const month = Math.floor(tick / WORK_TICKS_PER_MONTH) + 1;
  const tickInMonth = tick % WORK_TICKS_PER_MONTH;
  const weekInMonth = Math.floor(tickInMonth / WORK_TICKS_PER_WEEK) + 1;
  const workingDayInMonth = Math.floor(tickInMonth / WORK_TICKS_PER_DAY) + 1;

  // Calendar display mapping (weekends skipped).
  const fullWorkingWeeks = Math.floor(workingDayIndex / WORK_DAYS_PER_WEEK);
  const totalCalendarDays = fullWorkingWeeks * CALENDAR_DAYS_PER_WEEK + (workingDayIndex % WORK_DAYS_PER_WEEK);
  const monthWorkingDayIndex = Math.floor(tickInMonth / WORK_TICKS_PER_DAY); // 0..19
  const dayInMonth =
    Math.floor(monthWorkingDayIndex / WORK_DAYS_PER_WEEK) * CALENDAR_DAYS_PER_WEEK +
    (monthWorkingDayIndex % WORK_DAYS_PER_WEEK) +
    1;

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

/**
 * True for every valid tick: the clock advances only through scheduled
 * working time, so there are no night/weekend ticks. The function is kept
 * so scheduling layers can assert the invariant explicitly.
 */
export function isWorkingTick(tick: number): boolean {
  return getCalendar(tick).isWorkingDay;
}

/** Whole working days fully covered by the first `ticks` working ticks. */
export function countWorkingDays(ticks: number): number {
  assertNonNegativeInteger(ticks, "ticks");
  return Math.floor(ticks / WORK_TICKS_PER_DAY);
}

export function formatTime(tick: number): string {
  const c = getCalendar(tick);
  const hh = String(c.hours).padStart(2, "0");
  const mm = String(c.minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export function formatDate(tick: number): string {
  const c = getCalendar(tick);
  return `M${c.month} W${c.weekInMonth} ${DAY_NAMES[c.dayOfWeek]} ${formatTime(tick)}`;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}
