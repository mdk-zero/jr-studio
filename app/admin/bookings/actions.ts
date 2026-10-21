"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/app/admin/catalog/actions";
import {
  assignStaffSchema,
  bookingIdSchema,
  paymentSchema,
  rescheduleSchema,
  staffBookingSchema,
  statusChangeSchema,
  voidPaymentSchema,
} from "@/lib/validators/admin-booking";

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

/**
 * The booking functions raise messages written for people ("Only a pending
 * booking can be approved", "That is more than the ₱410.00 still owed"), so
 * those pass through. Constraint violations are translated here.
 */
function describe(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "23P01":
      return "That time is no longer free. Pick another slot; the list is up to date.";
    case "23505":
      return "A customer with that email already exists. Search for them instead of adding a new one.";
    case "23503":
      return "This booking has payments on record, so it cannot be deleted. Cancel it instead, and record a refund if money was returned.";
    case "42501":
      return "You do not have permission to do that.";
    default:
      return error.message;
  }
}

/**
 * Every write here changes what several back-office screens show (list,
 * calendar, detail, ledger), so the whole admin segment is refreshed.
 */
function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Status, schedule and staff
// ---------------------------------------------------------------------------
export async function setBookingStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = statusChangeSchema.safeParse({
    booking_id: formData.get("booking_id"),
    // Comes from the submit button that was pressed.
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_booking_status", {
    p_booking_id: parsed.data.booking_id,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return { message: describe(error) };

  refreshAdmin();
  const done = {
    approved: "Booking approved.",
    rejected: "Booking declined.",
    cancelled: "Booking cancelled.",
    completed: "Marked as completed.",
  } as const;
  return { ok: true, message: done[parsed.data.status] };
}

export async function rescheduleBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = rescheduleSchema.safeParse({
    booking_id: formData.get("booking_id"),
    starts_at: formData.get("starts_at"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: parsed.data.booking_id,
    p_starts_at: parsed.data.starts_at,
    p_note: parsed.data.note,
  });
  if (error) return { message: describe(error) };

  refreshAdmin();
  return { ok: true, message: "Booking moved." };
}

export async function assignStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = assignStaffSchema.safeParse({
    booking_id: formData.get("booking_id"),
    staff_id: formData.get("staff_id") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_booking_staff", {
    p_booking_id: parsed.data.booking_id,
    // Omitted means unassign (the function's default).
    p_staff_id: parsed.data.staff_id ?? undefined,
  });
  if (error) return { message: describe(error) };

  refreshAdmin();
  return { ok: true, message: parsed.data.staff_id ? "Staff assigned." : "Staff unassigned." };
}

/** Admin only, for bookings made in error. Payments block it at the database. */
export async function deleteBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = bookingIdSchema.safeParse({ booking_id: formData.get("booking_id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", parsed.data.booking_id)
    .select("id");
  if (error) return { message: describe(error) };
  if (!data?.length) return { message: "That booking could not be deleted." };

  refreshAdmin();
  redirect("/admin/bookings");
}

// ---------------------------------------------------------------------------
// Studio-made bookings
// ---------------------------------------------------------------------------
export async function createStaffBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = staffBookingSchema.safeParse({
    package_id: formData.get("package_id"),
    starts_at: formData.get("starts_at"),
    customer_mode: formData.get("customer_mode"),
    customer_id: formData.get("customer_id") ?? "",
    customer_name: formData.get("customer_name") || undefined,
    customer_email: formData.get("customer_email") ?? "",
    customer_phone: formData.get("customer_phone") ?? "",
    addon_ids: formData.getAll("addon_ids").map(String),
    staff_id: formData.get("staff_id") ?? "",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const input = parsed.data;
  const existing = input.customer_mode === "existing";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_booking", {
    p_package_id: input.package_id,
    p_starts_at: input.starts_at,
    p_customer_id: existing ? input.customer_id || undefined : undefined,
    p_customer_name: existing ? undefined : input.customer_name,
    p_customer_email: existing ? undefined : input.customer_email || undefined,
    p_customer_phone: existing ? undefined : input.customer_phone || undefined,
    p_addon_ids: input.addon_ids,
    p_staff_id: input.staff_id || undefined,
    p_notes: input.notes,
  });
  if (error) return { message: describe(error) };

  refreshAdmin();
  redirect(`/admin/bookings/${data.id}?created=1`);
}

// ---------------------------------------------------------------------------
// Payment ledger
// ---------------------------------------------------------------------------
export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = paymentSchema.safeParse({
    booking_id: formData.get("booking_id"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference_no: formData.get("reference_no") || undefined,
    paid_at: formData.get("paid_at") ?? "",
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    p_booking_id: parsed.data.booking_id,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_reference_no: parsed.data.reference_no,
    p_paid_at: parsed.data.paid_at,
    p_note: parsed.data.note,
  });
  if (error) return { message: describe(error) };

  refreshAdmin();
  return { ok: true, message: parsed.data.amount > 0 ? "Payment recorded." : "Refund recorded." };
}

export async function voidPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = voidPaymentSchema.safeParse({
    booking_id: formData.get("booking_id"),
    payment_id: formData.get("payment_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", {
    p_payment_id: parsed.data.payment_id,
    p_reason: parsed.data.reason,
  });
  if (error) return { message: describe(error) };

  refreshAdmin();
  return { ok: true, message: "Payment voided." };
}
