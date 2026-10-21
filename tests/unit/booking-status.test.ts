import { describe, expect, it } from "vitest";
import { canReschedule, canTakePayment, staffStatusActions } from "@/lib/booking-status";

const now = new Date("2026-10-19T02:00:00Z");
const future = new Date("2026-10-20T02:00:00Z");
const past = new Date("2026-10-18T02:00:00Z");

describe("staffStatusActions", () => {
  it("offers approval only before a pending session starts", () => {
    expect(staffStatusActions("pending", future, now)).toEqual(["approved", "rejected", "cancelled"]);
    expect(staffStatusActions("pending", past, now)).toEqual(["rejected", "cancelled"]);
  });

  it("never offers to reject an approved booking", () => {
    expect(staffStatusActions("approved", future, now)).not.toContain("rejected");
    expect(staffStatusActions("approved", past, now)).not.toContain("rejected");
  });

  it("offers completion only once the session has started", () => {
    expect(staffStatusActions("approved", future, now)).toEqual(["cancelled"]);
    expect(staffStatusActions("approved", past, now)).toEqual(["completed", "cancelled"]);
    // The start instant itself counts as started.
    expect(staffStatusActions("approved", now, now)).toContain("completed");
  });

  it("treats every other status as final", () => {
    for (const status of ["completed", "cancelled", "rejected", "expired"] as const) {
      expect(staffStatusActions(status, past, now)).toEqual([]);
      expect(staffStatusActions(status, future, now)).toEqual([]);
    }
  });
});

describe("rescheduling and payments", () => {
  it("reschedules only live bookings", () => {
    expect(canReschedule("pending")).toBe(true);
    expect(canReschedule("approved")).toBe(true);
    expect(canReschedule("completed")).toBe(false);
    expect(canReschedule("cancelled")).toBe(false);
  });

  it("takes money only while a booking is live or done", () => {
    expect(canTakePayment("completed")).toBe(true);
    expect(canTakePayment("cancelled")).toBe(false);
    expect(canTakePayment("expired")).toBe(false);
  });
});
