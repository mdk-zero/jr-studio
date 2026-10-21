/**
 * Asia/Manila date helpers.
 *
 * The legacy system computed dates with `new Date().toISOString()`, which is
 * UTC — in UTC+8 that silently booked the *previous* day and rejected "today"
 * as a past date. Everything here works in explicit wall-clock terms instead,
 * so a date the customer picks is the date that gets stored.
 */
export const MANILA_TZ = "Asia/Manila";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockIn(instant: Date): WallClock {
  const parts = partsFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl renders midnight as hour 24 in some runtimes.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Milliseconds that Manila is ahead of UTC at a given instant. */
function offsetMs(instant: Date): number {
  const w = wallClockIn(instant);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" for an instant, as seen in Manila. */
export function toManilaDateString(instant: Date = new Date()): string {
  const w = wallClockIn(instant);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Today's date in Manila, as "YYYY-MM-DD". */
export function manilaToday(): string {
  return toManilaDateString();
}

/**
 * Convert a Manila wall-clock date + time into the matching UTC instant.
 * `date` is "YYYY-MM-DD", `time` is "HH:mm" or "HH:mm:ss".
 */
export function manilaToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  // Subtract the zone offset to land on the real instant, then correct once in
  // case the first guess fell on the other side of an offset change.
  let utc = new Date(guess.getTime() - offsetMs(guess));
  const corrected = guess.getTime() - offsetMs(utc);
  if (corrected !== utc.getTime()) utc = new Date(corrected);
  return utc;
}

/** Minutes since midnight for "HH:mm[:ss]". */
export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

/** Inverse of timeToMinutes, e.g. 570 -> "09:30". */
export function minutesToTime(total: number): string {
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Add days to a "YYYY-MM-DD" string without drifting across time zones. */
export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "7:30 PM" in Manila. */
export function formatManilaTime(instant: Date | string): string {
  return timeFormatter.format(new Date(instant));
}

/** "Mon, Oct 5, 2026" in Manila. */
export function formatManilaDate(instant: Date | string): string {
  return dateFormatter.format(new Date(instant));
}

/** Weekday index (0 = Sunday) in Manila, matching the business_hours table. */
export function manilaWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "90" -> "1 hr 30 min". Durations are stored in minutes, never free text. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} hr`;
  return rest ? `${hourLabel} ${rest} min` : hourLabel;
}

/** The Monday of the week containing "YYYY-MM-DD". The studio's week starts on Monday. */
export function startOfWeek(date: string): string {
  const weekday = manilaWeekday(date);
  return addDaysToDateString(date, weekday === 0 ? -6 : 1 - weekday);
}

// Date-only strings carry no zone, so they are formatted as UTC calendar dates.
const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "Mon, Oct 19" for "2026-10-19". */
export function formatDateString(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return dayFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * A `<input type="datetime-local">` value ("2026-10-19T14:30"), read as Manila
 * wall-clock time, to its UTC instant.
 */
export function manilaDateTimeLocalToUtc(value: string): Date {
  const [date, time] = value.split("T");
  return manilaToUtc(date, time);
}

/** "2026-10" for the month containing an instant, as seen in Manila. */
export function manilaMonth(instant: Date = new Date()): string {
  return toManilaDateString(instant).slice(0, 7);
}

/** Shift a "YYYY-MM" month by whole months. */
export function addMonths(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + months, 1));
  return shifted.toISOString().slice(0, 7);
}

/** The UTC instants bounding a Manila calendar month: [start, end). */
export function manilaMonthRange(month: string): { start: Date; end: Date } {
  return {
    start: manilaToUtc(`${month}-01`, "00:00"),
    end: manilaToUtc(`${addMonths(month, 1)}-01`, "00:00"),
  };
}

/** "October 2026" for "2026-10". */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return monthFormatter.format(new Date(Date.UTC(y, m - 1, 1)));
}
