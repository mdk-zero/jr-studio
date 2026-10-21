import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addMonths, manilaMonth, manilaMonthRange } from "@/lib/datetime";
import { change, revenueByMonth, topPackages } from "@/lib/dashboard-math";
import { ADMIN_STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";
import { countAwaitingApproval } from "@/lib/admin-bookings";

const STATUSES = Object.keys(ADMIN_STATUS_LABEL) as BookingStatus[];

/**
 * Everything the dashboard shows, read with the signed-in staff member's own
 * session (RLS lets staff see all bookings and payments).
 *
 * The data is small (one studio, a year of sessions), so rows are fetched and
 * summed here rather than in SQL views; the sums use the same rules as the
 * Payments page, so the two always agree.
 */
export async function getDashboard() {
  const supabase = await createClient();
  const now = new Date();
  const month = manilaMonth(now);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 11));
  const { start: monthStart, end: monthEnd } = manilaMonthRange(month);
  const yearStart = manilaMonthRange(months[0]).start;

  const [
    { data: payments },
    { data: thisMonth },
    { data: upcoming },
    { data: requests },
    { data: yearBookings },
    { data: owing },
    { count: newCustomers },
    awaiting,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, paid_at, voided_at")
      .gte("paid_at", yearStart.toISOString())
      .lt("paid_at", monthEnd.toISOString()),
    supabase
      .from("bookings")
      .select("status")
      .gte("starts_at", monthStart.toISOString())
      .lt("starts_at", monthEnd.toISOString()),
    supabase
      .from("bookings")
      .select("id, reference, starts_at, ends_at, status, customers(full_name), packages(name), staff_members(full_name)")
      .in("status", ["pending", "approved"])
      .gte("ends_at", now.toISOString())
      .order("starts_at")
      .limit(8),
    supabase
      .from("bookings")
      .select("id, reference, starts_at, created_at, customers(full_name), packages(name)")
      .eq("status", "pending")
      .gt("starts_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select("package_id, status, total_amount, packages(name)")
      .gte("starts_at", yearStart.toISOString()),
    // Money still owed on sessions the studio has committed to.
    supabase
      .from("booking_payment_summary")
      .select("booking_id, balance")
      .gt("balance", 0),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
    countAwaitingApproval(),
  ]);

  // A balance only counts on a session the studio committed to: a cancelled or
  // declined request also shows its full price as "balance". Looked up in
  // batches, so the request URL stays short however many there are.
  const owingIds = (owing ?? []).map((o) => o.booking_id).filter((id): id is string => Boolean(id));
  const committedIds = new Set<string>();
  for (let i = 0; i < owingIds.length; i += 100) {
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .in("id", owingIds.slice(i, i + 100))
      .in("status", ["approved", "completed"]);
    for (const b of data ?? []) committedIds.add(b.id);
  }
  const outstanding = (owing ?? [])
    .filter((o) => o.booking_id && committedIds.has(o.booking_id))
    .reduce((sum, o) => sum + Number(o.balance), 0);

  const revenue = revenueByMonth(payments ?? [], months);
  const current = revenue.at(-1)!;
  const previous = revenue.at(-2)!;

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>;
  for (const b of thisMonth ?? []) statusCounts[b.status] += 1;

  return {
    month,
    current,
    previous,
    netChange: change(current.net, previous.net),
    outstanding: Math.round(outstanding * 100) / 100,
    sessionsThisMonth: statusCounts.approved + statusCounts.completed,
    awaiting,
    newCustomers: newCustomers ?? 0,
    statusCounts,
    revenue,
    upcoming: upcoming ?? [],
    requests: requests ?? [],
    topPackages: topPackages(
      (yearBookings ?? []).map((b) => ({
        package_id: b.package_id,
        name: b.packages?.name ?? "Package",
        status: b.status,
        total_amount: b.total_amount,
      })),
    ),
  };
}
