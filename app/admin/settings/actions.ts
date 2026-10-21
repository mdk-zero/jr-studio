"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { manilaToday, manilaToUtc, addDaysToDateString, formatDateString } from "@/lib/datetime";
import type { ActionState } from "@/app/admin/catalog/actions";
import {
  blockedDateSchema,
  bookingRulesSchema,
  businessHoursSchema,
  studioDetailsSchema,
} from "@/lib/validators/content";

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

/**
 * The footer (hours, contact details) is cached under "settings". Availability
 * reads these tables live, so a change applies to the next slot lookup.
 */
function refresh() {
  updateTag("settings");
  revalidatePath("/admin/settings");
}

export async function saveStudioDetailsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = studioDetailsSchema.safeParse({
    studio_name: formData.get("studio_name"),
    phone: formData.get("phone") ?? undefined,
    email: formData.get("email") ?? undefined,
    address: formData.get("address") ?? undefined,
    map_url: formData.get("map_url") ?? undefined,
    facebook: formData.get("facebook") ?? undefined,
    instagram: formData.get("instagram") ?? undefined,
    tiktok: formData.get("tiktok") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { facebook, instagram, tiktok, ...values } = parsed.data;
  // Only the networks that have a link, so the footer shows no dead names.
  const socials = Object.fromEntries(
    Object.entries({ facebook, instagram, tiktok }).filter(([, href]) => href),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_settings")
    .update({ ...values, socials, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Studio details saved. The website shows them now." };
}

export async function saveBookingRulesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = bookingRulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Booking rules saved." };
}

export async function saveBusinessHoursAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_open: formData.get(`is_open_${weekday}`) === "on",
    opens_at: String(formData.get(`opens_at_${weekday}`) ?? ""),
    closes_at: String(formData.get(`closes_at_${weekday}`) ?? ""),
  }));

  const parsed = businessHoursSchema.safeParse(days);
  if (!parsed.success) {
    // Report per day, keyed the way the form names its inputs.
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path;
      if (typeof index === "number" && typeof field === "string") {
        errors[`${field}_${days[index].weekday}`] = [issue.message];
      }
    }
    return { errors, message: "Check the highlighted days." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("business_hours").upsert(parsed.data, { onConflict: "weekday" });
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Opening hours saved. New bookings follow them straight away." };
}

export async function addBlockedDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = blockedDateSchema.safeParse({
    blocked_on: formData.get("blocked_on"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.blocked_on < manilaToday()) {
    return { errors: { blocked_on: ["Choose today or a later date"] } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_dates")
    .upsert(parsed.data, { onConflict: "blocked_on" });
  if (error) return { message: error.message };

  // Closing a day does not cancel what is already booked on it, so say so.
  const dayStart = manilaToUtc(parsed.data.blocked_on, "00:00");
  const dayEnd = manilaToUtc(addDaysToDateString(parsed.data.blocked_on, 1), "00:00");
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "approved"])
    .gte("starts_at", dayStart.toISOString())
    .lt("starts_at", dayEnd.toISOString());

  refresh();
  const day = formatDateString(parsed.data.blocked_on);
  return count
    ? {
        ok: true,
        message: `${day} is closed to new bookings. ${count} booking${count === 1 ? " is" : "s are"} already on that day; they are not cancelled automatically.`,
      }
    : { ok: true, message: `${day} is closed to new bookings.` };
}

export async function removeBlockedDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = blockedDateSchema.pick({ blocked_on: true }).safeParse({
    blocked_on: formData.get("blocked_on"),
  });
  if (!parsed.success) return { message: "That date could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("blocked_on", parsed.data.blocked_on);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Open for bookings again." };
}
