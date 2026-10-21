"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { formatManilaDate } from "@/lib/datetime";
import { sendEmail } from "@/lib/email/send";
import { feedbackRequestEmail } from "@/lib/email/templates";
import type { ActionState } from "@/app/admin/catalog/actions";
import { featureSchema, moderateSchema, testimonialEditSchema } from "@/lib/validators/content";

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

function describe(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "You do not have permission to do that.";
  return error.message;
}

/** The home page shows approved reviews, so every change refreshes it. */
function refresh() {
  updateTag("testimonials");
  revalidatePath("/admin/testimonials");
}

export async function moderateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const parsed = moderateSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return invalid(parsed.error);

  // Who reviewed it and when are stamped by a trigger; un-approving also
  // un-features it there.
  const supabase = await createClient();
  const { error } = await supabase
    .from("testimonials")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return { message: describe(error) };

  refresh();
  const done = {
    approved: "Published on the website.",
    rejected: "Hidden from the website.",
    pending: "Moved back to the review queue.",
  } as const;
  return { ok: true, message: done[parsed.data.status] };
}

export async function featureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const parsed = featureSchema.safeParse({
    id: formData.get("id"),
    is_featured: formData.get("is_featured") === "true",
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("testimonials")
    .update({ is_featured: parsed.data.is_featured })
    .eq("id", parsed.data.id)
    .eq("status", "approved");
  if (error) return { message: describe(error) };

  refresh();
  return {
    ok: true,
    message: parsed.data.is_featured ? "Featured first on the home page." : "No longer featured.",
  };
}

export async function editTestimonialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = testimonialEditSchema.safeParse({
    id: formData.get("id"),
    author_name: formData.get("author_name"),
    message: formData.get("message"),
    admin_notes: formData.get("admin_notes") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").update(values).eq("id", id);
  if (error) return { message: describe(error) };

  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteTestimonialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "That review could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", id.data);
  if (error) return { message: describe(error) };

  refresh();
  return { ok: true, message: "Review deleted." };
}

/**
 * Emails a completed session's customer a link to review it. The link needs
 * no account, which matters because most walk-ins never sign up.
 */
export async function requestFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();

  const id = z.string().uuid().safeParse(formData.get("booking_id"));
  if (!id.success) return { message: "That booking could not be found." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, starts_at, customer_id, customers(full_name, email), packages(name)")
    .eq("id", id.data)
    .maybeSingle();
  if (!booking) return { message: "That booking could not be found." };
  if (!booking.customers?.email) {
    return { message: "This customer has no email address. Add one to their record first." };
  }

  const { data: token, error } = await supabase.rpc("request_feedback", { p_booking_id: id.data });
  if (error || !token) return { message: error ? describe(error) : "The request could not be created." };

  const sent = await sendEmail(
    booking.customers.email,
    feedbackRequestEmail({
      firstName: booking.customers.full_name.split(" ")[0] || booking.customers.full_name,
      packageName: booking.packages?.name ?? "photo",
      sessionDate: formatManilaDate(booking.starts_at),
      link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/review/${token}`,
    }),
    { template: "feedback_request", bookingId: booking.id, customerId: booking.customer_id, createdBy: user.id },
  );

  revalidatePath("/admin/testimonials");
  if (!sent.ok) return { message: `The link is ready, but the email failed: ${sent.error}` };
  return { ok: true, message: `Review request sent to ${booking.customers.email}.` };
}
