"use server";

import { createPublicClient } from "@/lib/supabase/public";

export type UnsubscribeState = { ok?: boolean; message?: string };

/**
 * A button press, not the page load: mail scanners open links in emails, and
 * unsubscribing on GET would let them unsubscribe people by accident.
 */
export async function unsubscribeAction(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const token = String(formData.get("token") ?? "");
  const { data, error } = await createPublicClient().rpc("unsubscribe_marketing", { p_token: token });

  if (error || !data) return { message: "This unsubscribe link is not valid. Reply to any of our emails and we'll take you off the list." };
  return { ok: true, message: "You're unsubscribed. You'll still get emails about your own bookings." };
}
