import "server-only";

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RenderedEmail } from "@/lib/email/templates";

/**
 * Outgoing email through Resend, logged to email_log.
 *
 * EMAIL_MODE decides where mail really goes. Anything other than "live"
 * redirects every message to Resend's test inbox, so a dev database full of
 * sample customers (and staff seeded with made-up addresses) can never email
 * a real person. The log records the intended recipient either way, with
 * status "test" for a redirected send.
 *
 * Sending never throws: an email failing must not undo the booking change or
 * the message that caused it. Callers run it inside after(), so it also never
 * delays the response.
 */

const TEST_INBOX = "delivered@resend.dev";
const BATCH_SIZE = 100;

type Meta = {
  template: string;
  bookingId?: string | null;
  customerId?: string | null;
  createdBy?: string | null;
};

function settings() {
  const key = process.env.RESEND_API_KEY;
  return {
    resend: key ? new Resend(key) : null,
    from: process.env.EMAIL_FROM || "J&R Studio <bookings@jrstudio.digital>",
    // Replies go to a real inbox, not the sending domain (which only Resend reads).
    replyTo: process.env.STUDIO_NOTIFY_EMAIL || undefined,
    live: process.env.EMAIL_MODE === "live",
  };
}

/** Where studio notifications go, if anywhere. */
export function studioInbox(): string | null {
  return process.env.STUDIO_NOTIFY_EMAIL || null;
}

export async function sendEmail(
  to: string,
  email: RenderedEmail,
  meta: Meta,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const { resend, from, replyTo, live } = settings();
  const db = createAdminClient();
  const log = {
    to_email: to,
    subject: email.subject,
    template: meta.template,
    booking_id: meta.bookingId ?? null,
    customer_id: meta.customerId ?? null,
    created_by: meta.createdBy ?? null,
  };

  if (!resend) {
    await db.from("email_log").insert({ ...log, status: "skipped", error: "RESEND_API_KEY is not set" });
    return { ok: false, error: "Email is not set up yet." };
  }

  let id: string | null = null;
  let error: string | null = null;
  try {
    const result = await resend.emails.send({
      from,
      to: live ? to : TEST_INBOX,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo,
      headers,
    });
    id = result.data?.id ?? null;
    error = result.error?.message ?? null;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unknown error";
  }

  await db.from("email_log").insert({
    ...log,
    status: error ? "failed" : live ? "sent" : "test",
    provider_id: id,
    error,
  });

  return error ? { ok: false, error } : { ok: true };
}

export type CampaignRecipient = {
  customerId: string;
  email: string;
  render: () => RenderedEmail & { headers?: Record<string, string> };
};

/**
 * Sends one campaign, at most once per recipient.
 *
 * Every recipient is written to email_log as "queued" first, under the
 * campaign key. Rows that already exist are skipped by the unique index, so
 * re-submitting the same form sends only to people not yet reached. Then the
 * new rows are sent in batches of 100 and marked sent or failed.
 */
export async function sendCampaign(input: {
  key: string;
  subject: string;
  createdBy: string;
  recipients: CampaignRecipient[];
}): Promise<{ sent: number; skipped: number; failed: number; error?: string }> {
  const { resend, from, replyTo, live } = settings();
  if (!resend) return { sent: 0, skipped: 0, failed: 0, error: "Email is not set up yet." };

  const db = createAdminClient();
  const byEmail = new Map(input.recipients.map((r) => [r.email.toLowerCase(), r]));

  const { data: queued, error: queueError } = await db
    .from("email_log")
    .upsert(
      [...byEmail.entries()].map(([email, r]) => ({
        to_email: email,
        subject: input.subject,
        template: "campaign",
        status: "queued",
        customer_id: r.customerId,
        created_by: input.createdBy,
        campaign_key: input.key,
      })),
      { onConflict: "campaign_key,to_email", ignoreDuplicates: true },
    )
    .select("id, to_email");

  if (queueError) return { sent: 0, skipped: 0, failed: 0, error: queueError.message };

  const rows = queued ?? [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((row) => {
      const { headers, ...email } = byEmail.get(row.to_email)!.render();
      return {
        from,
        to: live ? row.to_email : TEST_INBOX,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo,
        headers,
      };
    });

    let ids: string[] = [];
    let error: string | null = null;
    try {
      const result = await resend.batch.send(payload);
      ids = (result.data?.data ?? []).map((d) => d.id);
      error = result.error?.message ?? null;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Unknown error";
    }

    await Promise.all(
      chunk.map((row, index) =>
        db
          .from("email_log")
          .update(
            error
              ? { status: "failed", error }
              : { status: live ? "sent" : "test", provider_id: ids[index] ?? null },
          )
          .eq("id", row.id),
      ),
    );

    if (error) failed += chunk.length;
    else sent += chunk.length;

    // Resend allows two requests a second by default.
    if (i + BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, 600));
  }

  return { sent, skipped: byEmail.size - rows.length, failed };
}
