"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sendCampaign } from "@/lib/email/send";
import { campaignEmail } from "@/lib/email/templates";
import type { ActionState } from "@/app/admin/catalog/actions";
import {
  campaignSchema,
  customerNoteSchema,
  customerSchema,
  customerStatusSchema,
} from "@/lib/validators/people";

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

function describe(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "23505":
      return "Another customer already has that email. Search for them instead of adding a duplicate.";
    case "23503":
      return "This customer has bookings, so the record cannot be deleted. Mark them inactive instead.";
    case "42501":
      return "You do not have permission to do that.";
    default:
      return error.message;
  }
}

function refresh(customerId?: string) {
  revalidatePath("/admin/customers");
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
export async function saveCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = customerSchema.safeParse({
    id: formData.get("id") || undefined,
    full_name: formData.get("full_name"),
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    address: formData.get("address") ?? undefined,
    tier: formData.get("tier") || undefined,
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  if (!id) {
    const { data, error } = await supabase.from("customers").insert(values).select("id").single();
    if (error) return { message: describe(error) };
    refresh();
    redirect(`/admin/customers/${data.id}?created=1`);
  }

  const { data: current } = await supabase
    .from("customers")
    .select("profile_id, email")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { message: "That customer no longer exists." };

  // A linked account's email is its login. Changing it here would split the
  // record from the account, so it stays as the customer verified it.
  const update = current.profile_id ? { ...values, email: current.email } : values;

  const { error } = await supabase.from("customers").update(update).eq("id", id);
  if (error) return { message: describe(error) };

  refresh(id);
  return { ok: true, message: "Customer details saved." };
}

export async function setCustomerStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = customerStatusSchema.safeParse({
    customer_id: formData.get("customer_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.customer_id);
  if (error) return { message: describe(error) };

  refresh(parsed.data.customer_id);
  return {
    ok: true,
    message:
      parsed.data.status === "inactive"
        ? "Marked inactive. They no longer appear in searches or bulk email."
        : "Active again.",
  };
}

/** For records made in error. RESTRICT on bookings refuses anyone with history. */
export async function deleteCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = z.string().uuid().safeParse(formData.get("customer_id"));
  if (!id.success) return { message: "That customer could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id.data);
  if (error) return { message: describe(error) };

  refresh();
  redirect("/admin/customers?deleted=1");
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const parsed = customerNoteSchema.safeParse({
    customer_id: formData.get("customer_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) return invalid(parsed.error);

  // author_id defaults to the signed-in user, and the policy insists on it.
  const supabase = await createClient();
  const { error } = await supabase.from("customer_notes").insert(parsed.data);
  if (error) return { message: describe(error) };

  refresh(parsed.data.customer_id);
  return { ok: true, message: "Note added." };
}

export async function deleteNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({ id: z.string().uuid(), customer_id: z.string().uuid() })
    .safeParse({ id: formData.get("id"), customer_id: formData.get("customer_id") });
  if (!parsed.success) return { message: "That note could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from("customer_notes").delete().eq("id", parsed.data.id);
  if (error) return { message: describe(error) };

  refresh(parsed.data.customer_id);
  return { ok: true, message: "Note deleted." };
}

// ---------------------------------------------------------------------------
// Bulk email
// ---------------------------------------------------------------------------
export type CampaignState = ActionState & { sent?: number; skipped?: number };

/**
 * Sends to every active customer who agreed to promotional email, optionally
 * one tier only. Each recipient gets their own unsubscribe link, in the body
 * and in the List-Unsubscribe header that mail apps turn into a button.
 */
export async function sendCampaignAction(
  _prev: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const user = await requireAdmin();

  const parsed = campaignSchema.safeParse({
    campaign_key: formData.get("campaign_key"),
    tier: formData.get("tier") || undefined,
    subject: formData.get("subject"),
    body: formData.get("body"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, full_name, email, unsubscribe_token")
    .eq("status", "active")
    .eq("marketing_opt_in", true)
    .not("email", "is", null);
  if (parsed.data.tier !== "all") query = query.eq("tier", parsed.data.tier);

  const { data: audience, error } = await query;
  if (error) return { message: describe(error) };

  const recipients = (audience ?? []).filter((c) => c.email);
  if (recipients.length === 0) {
    return { message: "Nobody in that group has agreed to promotional email yet." };
  }

  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const { subject, body, campaign_key } = parsed.data;

  const result = await sendCampaign({
    key: campaign_key,
    subject,
    createdBy: user.id,
    recipients: recipients.map((c) => ({
      customerId: c.id,
      email: c.email!,
      render: () => {
        const page = `${site}/unsubscribe?token=${c.unsubscribe_token}`;
        const oneClick = `${site}/api/unsubscribe?token=${c.unsubscribe_token}`;
        return {
          ...campaignEmail({
            subject,
            body,
            name: c.full_name.split(" ")[0] || c.full_name,
            unsubscribeUrl: page,
          }),
          // RFC 8058 one-click unsubscribe; Gmail and Yahoo require it for bulk mail.
          headers: {
            "List-Unsubscribe": `<${oneClick}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      },
    })),
  });

  // In the response itself, so "Sent recently" updates and the form gets a
  // fresh campaign key for the next email.
  revalidatePath("/admin/customers/email");

  if (result.error) return { message: result.error };
  if (result.sent === 0 && result.failed === 0) {
    return { ok: true, message: "Already sent. Nobody new to send to." };
  }
  if (result.failed > 0) {
    return {
      message: `Sent ${result.sent}, but ${result.failed} could not be sent. They are marked failed in the log.`,
      sent: result.sent,
    };
  }
  return {
    ok: true,
    message: `Sent to ${result.sent} customer${result.sent === 1 ? "" : "s"}.${
      result.skipped ? ` ${result.skipped} had already received it.` : ""
    }`,
    sent: result.sent,
    skipped: result.skipped,
  };
}
