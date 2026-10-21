"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv, serverEnv } from "@/lib/env";
import { sendEmail, studioInbox } from "@/lib/email/send";
import { contactNotificationEmail } from "@/lib/email/templates";
import { contactSchema } from "@/lib/validators/content";

export type ContactState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
};

const HOUR = 60 * 60 * 1000;
const PER_SENDER_PER_HOUR = 3;
const SITE_WIDE_PER_TEN_MINUTES = 30;

/**
 * The IP, salted and hashed. Enough to count repeat submissions from one
 * address without ever storing the address itself.
 */
async function clientHash(): Promise<string> {
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || serverEnv().SUPABASE_SECRET_KEY;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * The website's contact form. The legacy form posted to nothing, so messages
 * were lost; these land in the admin inbox and, when a studio inbox is set,
 * also arrive by email.
 *
 * Writes use the secret key: visitors no longer hold INSERT on the table, so
 * this action (and its limits) is the only way in.
 */
export async function submitContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    message: formData.get("message"),
    website: formData.get("website") ?? undefined,
  });

  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
    // A filled honeypot gets the normal thank-you, so a bot learns nothing.
    if (errors.website) return { ok: true, message: "Thank you! We'll get back to you soon." };
    return { errors };
  }

  const { name, email, phone } = parsed.data;
  const message = { name, email, phone, message: parsed.data.message };
  const hash = await clientHash();
  const db = createAdminClient();
  const hourAgo = new Date(Date.now() - HOUR).toISOString();

  const [{ count: fromClient }, { count: fromEmail }, { count: siteWide }] = await Promise.all([
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("client_hash", hash).gte("created_at", hourAgo),
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("email", message.email).gte("created_at", hourAgo),
    db
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - HOUR / 6).toISOString()),
  ]);

  if ((fromClient ?? 0) >= PER_SENDER_PER_HOUR || (fromEmail ?? 0) >= PER_SENDER_PER_HOUR) {
    return {
      message:
        "We already have a few messages from you and will reply soon. For anything urgent, please call or message the studio.",
    };
  }
  if ((siteWide ?? 0) >= SITE_WIDE_PER_TEN_MINUTES) {
    return { message: "We're receiving a lot of messages right now. Please try again in a few minutes." };
  }

  const { error } = await db.from("contact_messages").insert({ ...message, client_hash: hash });
  if (error) return { message: "Your message could not be sent. Please try again, or call the studio." };

  const inbox = studioInbox();
  if (inbox) {
    after(() =>
      sendEmail(
        inbox,
        contactNotificationEmail({
          ...message,
          link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/messages`,
        }),
        { template: "contact_notification" },
      ),
    );
  }

  return { ok: true, message: "Thank you! We'll get back to you soon." };
}
