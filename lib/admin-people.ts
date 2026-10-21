import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactMatch, searchTerm } from "@/lib/search";
import type { CustomerListFilters } from "@/lib/validators/people";

export const CUSTOMER_PAGE_SIZE = 25;

const CUSTOMER_FIELDS =
  "id, full_name, email, phone, tier, status, profile_id, marketing_opt_in, created_at" as const;

/**
 * The customer list, filtered, searched and paged in the database. The legacy
 * page loaded every client and paged twelve at a time in the browser.
 */
export async function listCustomers(filters: CustomerListFilters) {
  const supabase = await createClient();

  let query = supabase.from("customers").select(CUSTOMER_FIELDS, { count: "exact" });

  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.tier !== "all") query = query.eq("tier", filters.tier);
  if (filters.account === "login") query = query.not("profile_id", "is", null);
  if (filters.account === "walkin") query = query.is("profile_id", null);
  if (filters.marketing === "yes") query = query.eq("marketing_opt_in", true);

  const term = searchTerm(filters.q);
  if (term) query = query.or(contactMatch(term));

  query =
    filters.sort === "newest"
      ? query.order("created_at", { ascending: false })
      : query.order("full_name");

  const from = (filters.page - 1) * CUSTOMER_PAGE_SIZE;
  const { data, count } = await query.range(from, from + CUSTOMER_PAGE_SIZE - 1);
  const rows = data ?? [];

  const { data: summaries } = rows.length
    ? await supabase
        .from("customer_summary")
        .select("customer_id, bookings_count, last_session_at, next_session_at, total_paid")
        .in("customer_id", rows.map((r) => r.id))
    : { data: [] };

  const total = count ?? 0;
  return {
    rows: rows.map((row) => ({
      ...row,
      summary: (summaries ?? []).find((s) => s.customer_id === row.id) ?? null,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)),
  };
}

/** One customer with everything the studio knows about them. */
export async function getCustomer(id: string) {
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, full_name, email, phone, address, tier, status, profile_id, marketing_opt_in, marketing_opt_in_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!customer) return null;

  const [{ data: summary }, { data: notes }, { data: bookings }, { data: emails }] = await Promise.all([
    supabase.from("customer_summary").select("*").eq("customer_id", id).maybeSingle(),
    supabase
      .from("customer_notes")
      .select("id, body, created_at, profiles(full_name)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, reference, starts_at, ends_at, status, total_amount, source, packages(name)")
      .eq("customer_id", id)
      .order("starts_at", { ascending: false })
      .limit(50),
    supabase
      .from("email_log")
      .select("id, subject, template, status, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const bookingRows = bookings ?? [];
  const { data: payments } = bookingRows.length
    ? await supabase
        .from("booking_payment_summary")
        .select("booking_id, payment_status, balance, paid_total")
        .in("booking_id", bookingRows.map((b) => b.id))
    : { data: [] };

  return {
    ...customer,
    summary,
    notes: notes ?? [],
    bookings: bookingRows.map((b) => ({
      ...b,
      payment: (payments ?? []).find((p) => p.booking_id === b.id) ?? null,
    })),
    emails: emails ?? [],
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

/**
 * Login state for a linked account. The profile row says what role it has;
 * whether the invite was ever accepted lives on auth.users, which only the
 * secret key can read. Callers must already have checked for an admin.
 */
async function loginStates(profileIds: string[]) {
  if (profileIds.length === 0) return new Map<string, { confirmed: boolean; lastSignIn: string | null }>();
  const admin = createAdminClient();

  const entries = await Promise.all(
    profileIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return [
        id,
        {
          confirmed: Boolean(data.user?.email_confirmed_at),
          lastSignIn: data.user?.last_sign_in_at ?? null,
        },
      ] as const;
    }),
  );
  return new Map(entries);
}

export type StaffAccess =
  | { kind: "none" }
  | { kind: "invited"; role: "staff" | "admin"; invitedAt: string | null }
  | { kind: "active"; role: "staff" | "admin"; lastSignIn: string | null }
  | { kind: "revoked" };

/** Everyone on the team, with their back-office access. Admin only. */
export async function listStaff() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_members")
    .select(
      "id, full_name, email, phone, address, position, birthday, hire_date, status, show_on_about, bio, photo_path, sort_order, invited_at, profile_id, profiles(id, role, email)",
    )
    .order("status")
    .order("sort_order")
    .order("full_name");

  const rows = data ?? [];
  const states = await loginStates(rows.flatMap((r) => (r.profile_id ? [r.profile_id] : [])));

  return rows.map((row) => {
    let access: StaffAccess = { kind: "none" };
    const profile = row.profiles;
    if (profile) {
      const state = states.get(profile.id);
      if (profile.role === "customer") access = { kind: "revoked" };
      else if (!state?.confirmed) access = { kind: "invited", role: profile.role, invitedAt: row.invited_at };
      else access = { kind: "active", role: profile.role, lastSignIn: state.lastSignIn };
    }
    return { ...row, access };
  });
}

export type StaffRow = Awaited<ReturnType<typeof listStaff>>[number];
