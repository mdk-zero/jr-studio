"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentCustomerId, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { bookingIdSchema, profileSchema } from "@/lib/validators/booking";
import { reviewSchema } from "@/lib/validators/content";

export type AccountState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
  undoUntil?: string;
};

export async function cancelBookingAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireUser();

  const parsed = bookingIdSchema.safeParse({ booking_id: formData.get("booking_id") });
  if (!parsed.success) return { message: "That booking could not be found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: parsed.data.booking_id,
  });

  // The RPC owns the rules: ownership, an allowed status, and the studio's
  // cancellation cutoff. Its message is already written for the customer.
  if (error) return { message: error.message };

  const booking = data as unknown as { cancelled_at: string } | null;
  revalidatePath("/account");
  revalidatePath(`/account/bookings/${parsed.data.booking_id}`);

  return {
    ok: true,
    message: "Booking cancelled.",
    undoUntil: booking?.cancelled_at ?? undefined,
  };
}

export async function undoCancelBookingAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireUser();

  const parsed = bookingIdSchema.safeParse({ booking_id: formData.get("booking_id") });
  if (!parsed.success) return { message: "That booking could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_cancel_booking", {
    p_booking_id: parsed.data.booking_id,
  });

  if (error) {
    // The slot can be gone: the exclusion constraint re-checks on the way back in.
    if (error.code === "23P01") {
      return { message: "That time has been taken since you cancelled, so it cannot be restored." };
    }
    return { message: error.message };
  }

  revalidatePath("/account");
  revalidatePath(`/account/bookings/${parsed.data.booking_id}`);
  return { ok: true, message: "Booking restored." };
}

export async function updateProfileAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser("/account/profile");

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { full_name, phone, address, marketing_opt_in } = parsed.data;

  // Role is deliberately absent here; a trigger blocks changing it anyway.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, phone: phone || null })
    .eq("id", user.id);
  if (profileError) return { message: profileError.message };

  const { error: customerError } = await supabase
    .from("customers")
    .update({ full_name, phone: phone || null, address: address || null, marketing_opt_in })
    .eq("profile_id", user.id);
  if (customerError) return { message: customerError.message };

  revalidatePath("/account/profile");
  return { ok: true, message: "Profile updated." };
}

/**
 * A review of the customer's own completed session. RLS checks the booking is
 * theirs and completed, and that the review arrives unpublished; staff decide
 * what goes on the website.
 */
export async function submitTestimonialAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireUser();

  const booking = bookingIdSchema.safeParse({ booking_id: formData.get("booking_id") });
  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    message: formData.get("message"),
    author_name: formData.get("author_name"),
  });
  if (!booking.success) return { message: "That booking could not be found." };
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const customerId = await getCurrentCustomerId();
  if (!customerId) return { message: "Your account has no customer record. Please contact the studio." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("bookings")
    .select("package_id")
    .eq("id", booking.data.booking_id)
    .maybeSingle();
  if (!row) return { message: "That booking could not be found." };

  const { error } = await supabase.from("testimonials").insert({
    customer_id: customerId,
    booking_id: booking.data.booking_id,
    package_id: row.package_id,
    ...parsed.data,
  });

  if (error) {
    if (error.code === "23505") return { ok: true, message: "Your review is already in. Thank you!" };
    // The insert policy refuses anything but your own completed session.
    if (error.code === "42501") return { message: "Reviews open once your session is completed." };
    return { message: error.message };
  }

  revalidatePath(`/account/bookings/${booking.data.booking_id}`);
  return { ok: true, message: "Thank you! The studio will read it before it appears on the website." };
}
