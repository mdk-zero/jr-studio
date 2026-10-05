import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  formatManilaDate,
  manilaToUtc,
  manilaWeekday,
  minutesToTime,
  timeToMinutes,
  toManilaDateString,
} from "@/lib/datetime";

describe("manilaToUtc", () => {
  it("treats the input as Manila wall-clock time (UTC+8)", () => {
    expect(manilaToUtc("2026-10-05", "09:00").toISOString()).toBe(
      "2026-10-05T01:00:00.000Z",
    );
  });

  it("handles an early-morning slot that crosses the UTC date boundary", () => {
    // 08:00 Manila is 00:00 UTC the same day.
    expect(manilaToUtc("2026-10-05", "08:00").toISOString()).toBe(
      "2026-10-05T00:00:00.000Z",
    );
  });

  it("handles an evening slot that lands on the next UTC day", () => {
    expect(manilaToUtc("2026-10-05", "20:00").toISOString()).toBe(
      "2026-10-05T12:00:00.000Z",
    );
  });

  it("accepts seconds", () => {
    expect(manilaToUtc("2026-01-01", "00:00:00").toISOString()).toBe(
      "2025-12-31T16:00:00.000Z",
    );
  });
});

describe("toManilaDateString", () => {
  it("returns the Manila date, not the UTC date", () => {
    // 16:30 UTC is 00:30 the NEXT day in Manila. The legacy code used
    // toISOString() here and stored the wrong day.
    expect(toManilaDateString(new Date("2026-10-04T16:30:00Z"))).toBe("2026-10-05");
  });

  it("agrees with manilaToUtc as a round trip", () => {
    for (const time of ["08:00", "12:00", "17:30", "23:59"]) {
      expect(toManilaDateString(manilaToUtc("2026-03-15", time))).toBe("2026-03-15");
    }
  });

  it("keeps midnight on its own day", () => {
    expect(toManilaDateString(manilaToUtc("2026-07-01", "00:00"))).toBe("2026-07-01");
  });
});

describe("time helpers", () => {
  it("converts both ways", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(timeToMinutes("20:00"))).toBe("20:00");
  });
});

describe("addDaysToDateString", () => {
  it("crosses month and year boundaries", () => {
    expect(addDaysToDateString("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateString("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles a leap day", () => {
    expect(addDaysToDateString("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("manilaWeekday", () => {
  it("matches business_hours weekday numbering (0 = Sunday)", () => {
    expect(manilaWeekday("2026-10-04")).toBe(0); // Sunday
    expect(manilaWeekday("2026-10-05")).toBe(1); // Monday
    expect(manilaWeekday("2026-10-10")).toBe(6); // Saturday
  });
});

describe("formatManilaDate", () => {
  it("formats an instant in Manila, not UTC", () => {
    // Still Oct 5 in Manila even though it is Oct 4 in UTC.
    expect(formatManilaDate(new Date("2026-10-04T16:30:00Z"))).toContain("Oct 5");
  });
});
