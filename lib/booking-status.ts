import type { Database } from "@/lib/supabase/database.types";

/**
 * Booking and payment vocabulary shared by server and client code. No
 * `server-only` here: the admin's status buttons and badges render in client
 * components too.
 */
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

/** Customer-facing wording. */
export const STATUS_COPY: Record<BookingStatus, { label: string; tone: string }> = {
  pending: { label: "Awaiting confirmation", tone: "bg-sand-200 text-ink" },
  approved: { label: "Confirmed", tone: "bg-burgundy-50 text-burgundy-700" },
  completed: { label: "Completed", tone: "bg-burgundy-100 text-burgundy-800" },
  cancelled: { label: "Cancelled", tone: "bg-sand-200 text-muted" },
  rejected: { label: "Declined", tone: "bg-red-50 text-red-700" },
  expired: { label: "Expired", tone: "bg-sand-200 text-muted" },
};

/** The back office talks in workflow terms; the tones match STATUS_COPY. */
export const ADMIN_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  expired: "Expired",
};

export const PAYMENT_COPY: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "bg-sand-200 text-muted" },
  partial: { label: "Part paid", tone: "bg-sand-300 text-ink" },
  paid: { label: "Paid", tone: "bg-burgundy-50 text-burgundy-700" },
  refunded: { label: "Refunded", tone: "bg-sand-200 text-muted" },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};

export const PAYMENT_METHODS = [
  "cash",
  "gcash",
  "bank_transfer",
  "card",
  "other",
] as const satisfies readonly PaymentMethod[];

/** Statuses that hold a slot on the calendar (the exclusion constraint's set). */
export const ACTIVE_STATUSES = ["pending", "approved", "completed"] as const satisfies readonly BookingStatus[];

export const STAFF_STATUS_ACTIONS = ["approved", "rejected", "cancelled", "completed"] as const;
export type StaffStatusAction = (typeof STAFF_STATUS_ACTIONS)[number];

/**
 * The status changes to offer staff. set_booking_status enforces the same
 * rules in the database; this only decides which buttons appear.
 *
 *   pending  -> approved (before it starts), rejected, cancelled
 *   approved -> completed (once it has started), cancelled
 */
export function staffStatusActions(
  status: BookingStatus,
  startsAt: Date,
  now: Date,
): StaffStatusAction[] {
  const started = startsAt.getTime() <= now.getTime();
  switch (status) {
    case "pending":
      return started ? ["rejected", "cancelled"] : ["approved", "rejected", "cancelled"];
    case "approved":
      return started ? ["completed", "cancelled"] : ["cancelled"];
    default:
      return [];
  }
}

/** Mirrors reschedule_booking. */
export function canReschedule(status: BookingStatus): boolean {
  return status === "pending" || status === "approved";
}

/** Mirrors record_payment: money in only while the booking is live; refunds always. */
export function canTakePayment(status: BookingStatus): boolean {
  return status === "pending" || status === "approved" || status === "completed";
}
