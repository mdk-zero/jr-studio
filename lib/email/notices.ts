import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { sendEmail, studioInbox } from "@/lib/email/send";
import { bookingUpdateEmail, newRequestEmail, type BookingEmailKind } from "@/lib/email/templates";

/**
 * Booking notifications. Callers have already authorized the change and run
 * these inside after(), so the secret-key client here only reads the row the
 * caller just changed, to address the email.
 */

async function loadBooking(bookingId: string) {
  const { data } = await createAdminClient()
    .from("bookings")
    .select("id, reference, starts_at, ends_at, notes, customer_id, customers(full_name, email, profile_id), packages(name)")
    .eq("id", bookingId)
    .maybeSingle();
  return data;
}

function when(startsAt: string, endsAt: string): string {
  return `${formatManilaDate(startsAt)}, ${formatManilaTime(startsAt)} – ${formatManilaTime(endsAt)}`;
}

/** To the customer: approved, declined, cancelled by the studio, or moved. */
export async function notifyCustomer(
  bookingId: string,
  kind: BookingEmailKind,
  note: string | null | undefined,
  actorId: string,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  const customer = booking?.customers;
  if (!booking || !customer?.email) return;

  await sendEmail(
    customer.email,
    bookingUpdateEmail({
      kind,
      name: customer.full_name.split(" ")[0] || customer.full_name,
      reference: booking.reference,
      packageName: booking.packages?.name ?? "Photo session",
      when: when(booking.starts_at, booking.ends_at),
      note,
      // Walk-ins have no account to open, so their email has no button.
      link: customer.profile_id
        ? `${publicEnv.NEXT_PUBLIC_SITE_URL}/account/bookings/${booking.id}`
        : null,
    }),
    {
      template: `booking_${kind}`,
      bookingId: booking.id,
      customerId: booking.customer_id,
      createdBy: actorId,
    },
  );
}

/** To the studio inbox, when a customer requests a session online. */
export async function notifyStudioOfRequest(bookingId: string): Promise<void> {
  const inbox = studioInbox();
  if (!inbox) return;

  const booking = await loadBooking(bookingId);
  if (!booking) return;

  await sendEmail(
    inbox,
    newRequestEmail({
      customerName: booking.customers?.full_name ?? "A customer",
      reference: booking.reference,
      packageName: booking.packages?.name ?? "Photo session",
      when: when(booking.starts_at, booking.ends_at),
      notes: booking.notes,
      link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/bookings/${booking.id}`,
    }),
    { template: "booking_request", bookingId: booking.id, customerId: booking.customer_id },
  );
}
