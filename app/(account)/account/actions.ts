"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { bookingIdSchema, profileSchema } from "@/lib/validators/booking";

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
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { full_name, phone, address } = parsed.data;

  // Role is deliberately absent here; a trigger blocks changing it anyway.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, phone: phone || null })
    .eq("id", user.id);
  if (profileError) return { message: profileError.message };

  const { error: customerError } = await supabase
    .from("customers")
    .update({ full_name, phone: phone || null, address: address || null })
    .eq("profile_id", user.id);
  if (customerError) return { message: customerError.message };

  revalidatePath("/account/profile");
  return { ok: true, message: "Profile updated." };
}
