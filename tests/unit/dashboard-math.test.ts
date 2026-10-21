import { describe, expect, it } from "vitest";
import { change, revenueByMonth, shares, topPackages } from "@/lib/dashboard-math";

describe("revenueByMonth", () => {
  const months = ["2026-09", "2026-10"];

  it("buckets by the Manila calendar month, not UTC", () => {
    // 00:30 on Oct 1 in Manila is still Sep 30 in UTC; the legacy date maths
    // would have filed it under September.
    const totals = revenueByMonth([{ amount: 500, paid_at: "2026-09-30T16:30:00Z", voided_at: null }], months);
    expect(totals).toEqual([
      { month: "2026-09", received: 0, refunded: 0, net: 0 },
      { month: "2026-10", received: 500, refunded: 0, net: 500 },
    ]);
  });

  it("subtracts refunds, skips voided entries and ignores months outside the range", () => {
    const totals = revenueByMonth(
      [
        { amount: 1500, paid_at: "2026-10-05T02:00:00Z", voided_at: null },
        { amount: -300, paid_at: "2026-10-06T02:00:00Z", voided_at: null },
        { amount: 9999, paid_at: "2026-10-07T02:00:00Z", voided_at: "2026-10-07T03:00:00Z" },
        { amount: 700, paid_at: "2026-08-15T02:00:00Z", voided_at: null },
      ],
      months,
    );
    expect(totals[1]).toEqual({ month: "2026-10", received: 1500, refunded: 300, net: 1200 });
    expect(totals[0].net).toBe(0);
  });

  it("does not drift on centavos", () => {
    const totals = revenueByMonth(
      [0.1, 0.2, 0.3].map((amount) => ({ amount, paid_at: "2026-10-05T02:00:00Z", voided_at: null })),
      months,
    );
    expect(totals[1].net).toBe(0.6);
  });

  it("accepts the string amounts Postgres returns for numeric", () => {
    const totals = revenueByMonth(
      [{ amount: "250.50" as unknown as number, paid_at: "2026-10-05T02:00:00Z", voided_at: null }],
      months,
    );
    expect(totals[1].received).toBe(250.5);
  });
});

describe("change", () => {
  it("is a whole percentage, or null without a baseline", () => {
    expect(change(1500, 1000)).toBe(50);
    expect(change(500, 1000)).toBe(-50);
    expect(change(500, 0)).toBeNull();
  });
});

describe("topPackages", () => {
  const row = (package_id: string, name: string, status: string, total_amount: number) => ({
    package_id,
    name,
    status,
    total_amount,
  });

  it("counts real sessions only and ranks by count, then value", () => {
    const top = topPackages([
      row("a", "Prenup", "completed", 8000),
      row("a", "Prenup", "approved", 8000),
      row("b", "Family", "completed", 3000),
      row("b", "Family", "pending", 3000),
      row("c", "Debut", "cancelled", 20000),
      row("c", "Debut", "rejected", 20000),
      row("c", "Debut", "expired", 20000),
    ]);
    expect(top).toEqual([
      { name: "Prenup", count: 2, value: 16000 },
      { name: "Family", count: 2, value: 6000 },
    ]);
  });

  it("limits the list", () => {
    const many = Array.from({ length: 8 }, (_, i) => row(`p${i}`, `P${i}`, "completed", 100));
    expect(topPackages(many, 5)).toHaveLength(5);
  });
});

describe("shares", () => {
  it("scales to the tallest bar and never goes negative", () => {
    expect(shares([0, 50, 100, -20])).toEqual([0, 0.5, 1, 0]);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});
