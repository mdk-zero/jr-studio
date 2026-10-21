import "server-only";

import { createClient } from "@/lib/supabase/server";

// The vocabulary lives in booking-status.ts so client components can use it.
export { PAYMENT_COPY, STATUS_COPY, type BookingStatus } from "@/lib/booking-status";

// One literal string: supabase-js infers the row type from the select text, so
// building it by concatenation loses the types.
const BOOKING_FIELDS =
  "id, reference, starts_at, ends_at, status, total_amount, package_price, addons_total, discount_amount, notes, cancelled_at, created_at, packages(name, slug, duration_minutes)" as const;

/** The signed-in customer's bookings. RLS restricts this to their own rows. */
export async function getMyBookings() {
  const supabase = await createClient();

  const [{ data: bookings }, { data: payments }] = await Promise.all([
    supabase.from("bookings").select(BOOKING_FIELDS).order("starts_at", { ascending: false }),
    supabase.from("booking_payment_summary").select("booking_id, paid_total, balance, payment_status"),
  ]);

  // "Upcoming" depends on the clock, so it is derived here rather than during
  // render: a component must be pure, and Date.now() in render is not.
  const now = Date.now();

  return (bookings ?? []).map((booking) => ({
    ...booking,
    payment: (payments ?? []).find((p) => p.booking_id === booking.id) ?? null,
    isUpcoming:
      new Date(booking.starts_at).getTime() >= now &&
      !["cancelled", "rejected", "expired"].includes(booking.status),
  }));
}

export async function getMyBooking(id: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(BOOKING_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (!booking) return null;

  const [{ data: addons }, { data: payment }, { data: events }, { data: settings }] =
    await Promise.all([
      supabase
        .from("booking_addons")
        .select("quantity, unit_price, addons(name)")
        .eq("booking_id", id),
      supabase
        .from("booking_payment_summary")
        .select("paid_total, balance, payment_status")
        .eq("booking_id", id)
        .maybeSingle(),
      supabase
        .from("booking_events")
        .select("id, type, from_status, to_status, note, created_at")
        .eq("booking_id", id)
        .order("created_at"),
      supabase
        .from("studio_settings")
        .select("cancel_cutoff_hours, undo_window_seconds")
        .single(),
    ]);

  const cancelCutoffHours = settings?.cancel_cutoff_hours ?? 24;

  // Same reasoning as above. The RPC enforces this rule regardless; this only
  // decides whether to offer the button.
  const cancellable =
    ["pending", "approved"].includes(booking.status) &&
    new Date(booking.starts_at).getTime() > Date.now() + cancelCutoffHours * 3600 * 1000;

  return {
    ...booking,
    addons: addons ?? [],
    payment,
    events: events ?? [],
    cancelCutoffHours,
    cancellable,
    undoWindowSeconds: settings?.undo_window_seconds ?? 300,
  };
}
