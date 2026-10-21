import "server-only";

import { createClient } from "@/lib/supabase/server";
import { manilaToday } from "@/lib/datetime";
import type { TESTIMONIAL_STATUSES } from "@/lib/validators/content";

export const CONTENT_PAGE_SIZE = 20;

type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

/** PostgREST returns a one-to-one embed as an object and one-to-many as an array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
export async function listTestimonials(filters: { status: TestimonialStatus | "all"; page: number }) {
  const supabase = await createClient();

  let query = supabase
    .from("testimonials")
    .select(
      "id, rating, message, author_name, status, is_featured, admin_notes, created_at, reviewed_at, customers(id, full_name), packages(name), bookings(id, reference, starts_at)",
      { count: "exact" },
    );
  if (filters.status !== "all") query = query.eq("status", filters.status);

  const from = (filters.page - 1) * CONTENT_PAGE_SIZE;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + CONTENT_PAGE_SIZE - 1);

  const counts = await Promise.all(
    (["pending", "approved", "rejected"] as const).map(async (status) => {
      const { count: n } = await supabase
        .from("testimonials")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return [status, n ?? 0] as const;
    }),
  );

  const total = count ?? 0;
  return {
    rows: data ?? [],
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CONTENT_PAGE_SIZE)),
    counts: Object.fromEntries(counts) as Record<TestimonialStatus, number>,
  };
}

/**
 * Completed sessions from the last 90 days that have no review yet: the list
 * the studio sends review requests from.
 */
export async function listReviewCandidates() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, reference, starts_at, customers(full_name, email), packages(name), testimonials(id), feedback_requests(sent_at, completed_at)",
    )
    .eq("status", "completed")
    .gte("starts_at", since)
    .order("starts_at", { ascending: false })
    .limit(40);

  return (data ?? [])
    .filter((b) => !one(b.testimonials))
    .map((b) => {
      const open = (b.feedback_requests ?? []).find((r) => !r.completed_at) ?? null;
      return {
        id: b.id,
        reference: b.reference,
        starts_at: b.starts_at,
        customer: b.customers,
        packageName: b.packages?.name ?? "Session",
        requestedAt: open?.sent_at ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// Contact inbox
// ---------------------------------------------------------------------------
export async function listMessages(filters: { filter: "unread" | "all"; page: number }) {
  const supabase = await createClient();

  let query = supabase
    .from("contact_messages")
    .select("id, name, email, phone, message, is_read, created_at", { count: "exact" });
  if (filters.filter === "unread") query = query.eq("is_read", false);

  const from = (filters.page - 1) * CONTENT_PAGE_SIZE;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + CONTENT_PAGE_SIZE - 1);

  const total = count ?? 0;
  return {
    rows: data ?? [],
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CONTENT_PAGE_SIZE)),
  };
}

/** Badge counts for the sidebar. */
export async function getInboxCounts() {
  const supabase = await createClient();
  const [{ count: unread }, { count: pendingReviews }] = await Promise.all([
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false),
    supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return { unread: unread ?? 0, pendingReviews: pendingReviews ?? 0 };
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
export async function getPortfolioAdmin() {
  const supabase = await createClient();

  const [{ data: albums }, { data: photos }, { data: categories }] = await Promise.all([
    supabase
      .from("albums")
      .select("id, title, slug, description, cover_path, category_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("portfolio_photos")
      .select("id, album_id, title, storage_path, width, height, sort_order, created_at")
      .order("sort_order")
      .order("created_at"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  const all = photos ?? [];
  return {
    albums: (albums ?? []).map((album) => ({
      ...album,
      photos: all.filter((p) => p.album_id === album.id),
    })),
    loose: all.filter((p) => !p.album_id),
    categories: categories ?? [],
  };
}

export type PortfolioAdmin = Awaited<ReturnType<typeof getPortfolioAdmin>>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function getSettingsAdmin() {
  const supabase = await createClient();

  const [{ data: settings }, { data: hours }, { data: blocked }] = await Promise.all([
    supabase.from("studio_settings").select("*").single(),
    supabase.from("business_hours").select("weekday, is_open, opens_at, closes_at").order("weekday"),
    supabase
      .from("blocked_dates")
      .select("blocked_on, reason")
      .gte("blocked_on", manilaToday())
      .order("blocked_on"),
  ]);

  return { settings, hours: hours ?? [], blocked: blocked ?? [] };
}
