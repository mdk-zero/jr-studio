import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_STATUSES,
  canReschedule,
  canTakePayment,
  staffStatusActions,
  type BookingStatus,
  type PaymentMethod,
} from "@/lib/booking-status";
import {
  addDaysToDateString,
  manilaMonthRange,
  manilaToUtc,
  manilaWeekday,
  toManilaDateString,
} from "@/lib/datetime";

export const PAGE_SIZE = 25;

export type BookingListFilters = {
  status: BookingStatus | "all";
  when: "upcoming" | "past" | "all";
  q: string;
  page: number;
};

// One literal per select: supabase-js infers row types from the text.
const LIST_FIELDS =
  "id, reference, starts_at, ends_at, status, total_amount, source, customers(full_name, phone), packages(name), staff_members(full_name)" as const;

/**
 * Keeps a search term to characters that cannot change the meaning of a
 * PostgREST or=() filter. Values are also double-quoted where they are used,
 * because dots (as in an email address) are reserved in that syntax.
 */
function searchTerm(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s@.+-]/gu, "").trim();
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Bookings for the back-office list, filtered and paged on the server.
 *
 * A page past the end comes back empty with no count (PostgREST refuses the
 * range outright), which the page treats as "nothing on this page".
 */
export async function listBookings(filters: BookingListFilters) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase.from("bookings").select(LIST_FIELDS, { count: "exact" });

  if (filters.status !== "all") query = query.eq("status", filters.status);
  // A session that is running now is still "upcoming" for the desk.
  if (filters.when === "upcoming") query = query.gte("ends_at", now);
  if (filters.when === "past") query = query.lt("ends_at", now);

  const term = searchTerm(filters.q);
  if (term) {
    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .or(`full_name.ilike."%${term}%",email.ilike."%${term}%",phone.ilike."%${term}%"`)
      .limit(200);
    const ids = (matches ?? []).map((c) => c.id);
    query = ids.length
      ? query.or(`reference.ilike."%${term}%",customer_id.in.(${ids.join(",")})`)
      : query.ilike("reference", `%${term}%`);
  }

  // The coming week reads soonest-first; anything reaching into the past reads
  // newest-first.
  query = query.order("starts_at", { ascending: filters.when === "upcoming" });

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const rows = data ?? [];

  const { data: payments } = rows.length
    ? await supabase
        .from("booking_payment_summary")
        .select("booking_id, payment_status, balance")
        .in("booking_id", rows.map((r) => r.id))
    : { data: [] };

  const total = count ?? 0;
  return {
    rows: rows.map((row) => ({
      ...row,
      payment: (payments ?? []).find((p) => p.booking_id === row.id) ?? null,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Pending requests whose session has not started: the approval queue. */
export async function countAwaitingApproval(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gt("starts_at", new Date().toISOString());
  return count ?? 0;
}

/** Seven days from `weekStart` (a Monday), with opening hours and bookings. */
export async function getWeek(weekStart: string) {
  const supabase = await createClient();
  const weekEnd = addDaysToDateString(weekStart, 7);

  const [{ data: bookings }, { data: hours }, { data: blocked }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, reference, starts_at, ends_at, status, customers(full_name), packages(name), staff_members(full_name)",
      )
      .in("status", ACTIVE_STATUSES)
      .gte("starts_at", manilaToUtc(weekStart, "00:00").toISOString())
      .lt("starts_at", manilaToUtc(weekEnd, "00:00").toISOString())
      .order("starts_at"),
    supabase.from("business_hours").select("weekday, is_open, opens_at, closes_at"),
    supabase
      .from("blocked_dates")
      .select("blocked_on, reason")
      .gte("blocked_on", weekStart)
      .lt("blocked_on", weekEnd),
  ]);

  const today = toManilaDateString();

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateString(weekStart, i);
    const day = (hours ?? []).find((h) => h.weekday === manilaWeekday(date));
    const block = (blocked ?? []).find((b) => b.blocked_on === date);
    return {
      date,
      isToday: date === today,
      isOpen: Boolean(day?.is_open) && !block,
      hours: day?.is_open ? { opens: day.opens_at, closes: day.closes_at } : null,
      blockedReason: block ? (block.reason ?? "Blocked") : null,
      bookings: (bookings ?? []).filter((b) => toManilaDateString(new Date(b.starts_at)) === date),
    };
  });
}

/** Everything the booking detail page shows and decides. */
export async function getStaffBooking(id: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, reference, starts_at, ends_at, status, source, notes, package_price, addons_total, discount_amount, total_amount, created_at, staff_id, customers(id, full_name, email, phone, tier, profile_id), packages(name, slug, duration_minutes), staff_members(id, full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking) return null;

  const [{ data: addons }, { data: payments }, { data: summary }, { data: events }, { data: staff }] =
    await Promise.all([
      supabase.from("booking_addons").select("quantity, unit_price, addons(name)").eq("booking_id", id),
      supabase
        .from("payments")
        .select(
          "id, amount, method, reference_no, paid_at, note, voided_at, void_reason, recorder:profiles!payments_recorded_by_fkey(full_name), voider:profiles!payments_voided_by_fkey(full_name)",
        )
        .eq("booking_id", id)
        .order("paid_at"),
      supabase
        .from("booking_payment_summary")
        .select("paid_total, balance, payment_status")
        .eq("booking_id", id)
        .maybeSingle(),
      supabase
        .from("booking_events")
        .select("id, type, from_status, to_status, note, created_at, profiles(full_name)")
        .eq("booking_id", id)
        .order("created_at"),
      supabase
        .from("staff_members")
        .select("id, full_name, position")
        .eq("status", "active")
        .order("sort_order"),
    ]);

  // Clock-dependent decisions are made here, not during render: components must
  // be pure, and Date.now() in render is not. The database re-checks all of it.
  const now = new Date();
  const startsAt = new Date(booking.starts_at);

  return {
    ...booking,
    durationMinutes: Math.round((new Date(booking.ends_at).getTime() - startsAt.getTime()) / 60_000),
    addons: addons ?? [],
    payments: payments ?? [],
    summary: summary ?? { paid_total: 0, balance: booking.total_amount, payment_status: "unpaid" },
    events: events ?? [],
    staffOptions: staff ?? [],
    statusActions: staffStatusActions(booking.status, startsAt, now),
    reschedulable: canReschedule(booking.status),
    payable: canTakePayment(booking.status),
  };
}

export type StaffBooking = NonNullable<Awaited<ReturnType<typeof getStaffBooking>>>;

/** Choices for the studio booking form. */
export async function getNewBookingOptions() {
  const supabase = await createClient();

  const [{ data: packages }, { data: links }, { data: addons }, { data: staff }] = await Promise.all([
    supabase
      .from("packages")
      .select("id, name, price, duration_minutes, categories(name)")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("package_addons").select("package_id, addon_id"),
    supabase.from("addons").select("id, name, price").eq("is_active", true),
    supabase.from("staff_members").select("id, full_name").eq("status", "active").order("sort_order"),
  ]);

  return {
    packages: (packages ?? []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      duration_minutes: pkg.duration_minutes,
      category: pkg.categories?.name ?? "",
      // Same rule quote_booking applies: only add-ons offered with the package.
      addons: (links ?? [])
        .filter((l) => l.package_id === pkg.id)
        .flatMap((l) => (addons ?? []).filter((a) => a.id === l.addon_id)),
    })),
    staff: staff ?? [],
  };
}

/** One Manila calendar month of the ledger, with totals that skip voids. */
export async function getLedger(month: string) {
  const supabase = await createClient();
  const { start, end } = manilaMonthRange(month);

  const { data } = await supabase
    .from("payments")
    .select(
      "id, amount, method, reference_no, paid_at, note, voided_at, void_reason, bookings(id, reference, customers(full_name)), recorder:profiles!payments_recorded_by_fkey(full_name)",
    )
    .gte("paid_at", start.toISOString())
    .lt("paid_at", end.toISOString())
    .order("paid_at", { ascending: false });

  const rows = data ?? [];
  const counted = rows.filter((p) => !p.voided_at);

  const byMethod = new Map<PaymentMethod, number>();
  for (const p of counted) byMethod.set(p.method, money((byMethod.get(p.method) ?? 0) + p.amount));

  const received = money(counted.filter((p) => p.amount > 0).reduce((sum, p) => sum + p.amount, 0));
  const refunded = money(-counted.filter((p) => p.amount < 0).reduce((sum, p) => sum + p.amount, 0));

  return {
    rows,
    received,
    refunded,
    net: money(received - refunded),
    byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
  };
}
