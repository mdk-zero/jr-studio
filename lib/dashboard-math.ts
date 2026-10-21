import { manilaMonth } from "@/lib/datetime";

/**
 * The dashboard's arithmetic, kept free of I/O so it can be tested on its own.
 * The legacy dashboard summed a payments table nothing ever wrote to, printed
 * "$", and bucketed by UTC date; these work on the real ledger, in pesos, by
 * Manila calendar month.
 */

export type LedgerEntry = { amount: number; paid_at: string; voided_at: string | null };

export type MonthTotals = { month: string; received: number; refunded: number; net: number };

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Received, refunded and net per Manila month, voided entries excluded. */
export function revenueByMonth(entries: LedgerEntry[], months: string[]): MonthTotals[] {
  const totals = new Map(months.map((m) => [m, { received: 0, refunded: 0 }]));
  for (const entry of entries) {
    if (entry.voided_at) continue;
    const bucket = totals.get(manilaMonth(new Date(entry.paid_at)));
    if (!bucket) continue;
    const amount = Number(entry.amount);
    if (amount > 0) bucket.received += amount;
    else bucket.refunded -= amount;
  }
  return months.map((month) => {
    const { received, refunded } = totals.get(month)!;
    return { month, received: money(received), refunded: money(refunded), net: money(received - refunded) };
  });
}

/** Percentage change from `before` to `now`, or null when there is no baseline. */
export function change(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

export type BookedPackage = {
  package_id: string | null;
  name: string;
  status: string;
  total_amount: number;
};

/**
 * Most-booked packages. Cancelled, declined and expired bookings are left out:
 * they are requests that never became sessions.
 */
export function topPackages(bookings: BookedPackage[], limit = 5) {
  const live = new Set(["pending", "approved", "completed"]);
  const byPackage = new Map<string, { name: string; count: number; value: number }>();
  for (const b of bookings) {
    if (!live.has(b.status) || !b.package_id) continue;
    const row = byPackage.get(b.package_id) ?? { name: b.name, count: 0, value: 0 };
    row.count += 1;
    row.value = money(row.value + Number(b.total_amount));
    byPackage.set(b.package_id, row);
  }
  return [...byPackage.values()]
    .sort((a, b) => b.count - a.count || b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Bar heights as a share of the tallest bar, so a chart needs no axis maths. */
export function shares(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.max(0, v) / max : 0));
}
