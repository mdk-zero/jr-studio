"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createBookingSchema } from "@/lib/validators/booking";
import { notifyStudioOfRequest } from "@/lib/email/notices";

export type BookingState = {
  errors?: Record<string, string[]>;
  message?: string;
};

/**
 * Creates a booking through the create_booking RPC.
 *
 * The RPC re-derives the price from quote_booking and re-checks the slot, so
 * nothing posted from the browser is trusted — the legacy endpoint took both
 * the client id and the amount straight from the request body.
 */
export async function createBookingAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  await requireUser("/book");

  const parsed = createBookingSchema.safeParse({
    package_id: formData.get("package_id"),
    starts_at: formData.get("starts_at"),
    addon_ids: formData.getAll("addon_ids").map(String),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_package_id: parsed.data.package_id,
    p_starts_at: parsed.data.starts_at,
    p_addon_ids: parsed.data.addon_ids,
    p_notes: parsed.data.notes ?? undefined,
  });

  if (error) {
    // 23P01 is the exclusion constraint, raised both when someone else took the
    // slot a moment earlier and when the requested time is not on offer.
    if (error.code === "23P01") {
      return {
        message:
          "That slot was taken while you were booking. Pick another time — the list below is up to date.",
      };
    }
    if (error.code === "42501") {
      return { message: "Your account cannot book right now. Please contact the studio." };
    }
    return { message: error.message };
  }

  const booking = data as unknown as { id: string } | null;
  if (!booking?.id) return { message: "The booking could not be created. Please try again." };

  // after() runs even though redirect() throws below.
  after(() => notifyStudioOfRequest(booking.id));
  redirect(`/account/bookings/${booking.id}?created=1`);
}
