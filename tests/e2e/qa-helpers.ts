import { mkdirSync, writeFileSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { adminDb, bookableDate } from "./helpers";

/**
 * Helpers for the QA-authored specs. Kept apart from helpers.ts so the project
 * team's original file is left as it was.
 */

/**
 * Takes a screenshot at a key moment of a test. It is attached to the HTML
 * report and also saved under qa/evidence/, so the QA document can show what
 * the page looked like while the check passed (the automatic end-of-test
 * screenshot is taken after clean-up, when the session is already gone).
 */
export async function evidence(page: Page, testInfo: TestInfo, name: string, options: { fullPage?: boolean } = {}) {
  // A full-page capture draws a fixed header at the current scroll position,
  // where it would cover part of the page; start from the top.
  if (options.fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  const body = await page.screenshot({ fullPage: options.fullPage ?? false });
  mkdirSync("qa/evidence", { recursive: true });
  writeFileSync(`qa/evidence/${name}.png`, body);
  await testInfo.attach(name, { body, contentType: "image/png" });
}

/** Saves a short text record of what a test observed, next to the screenshots. */
export async function observation(testInfo: TestInfo, name: string, text: string) {
  mkdirSync("qa/evidence", { recursive: true });
  writeFileSync(`qa/evidence/${name}.txt`, text);
  await testInfo.attach(name, { body: text, contentType: "text/plain" });
}

/**
 * A booking made the way the customer's browser makes it (sign in, pick the
 * first open slot, call create_booking), without clicking through the booking
 * page. Used as set-up for the tests that are about the studio's side.
 */
export async function createCustomerBooking(
  account: { email: string; password: string },
  packageSlug: string,
  daysAhead: number,
) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: signInError } = await client.auth.signInWithPassword(account);
  if (signInError) throw signInError;

  const { data: pkg, error: pkgError } = await client.from("packages").select("id").eq("slug", packageSlug).single();
  if (pkgError) throw pkgError;

  const date = bookableDate(daysAhead);
  const { data: slots } = await client.rpc("available_slots", { p_package_id: pkg.id, p_date: date });
  const slot = slots?.[0];
  if (!slot) throw new Error(`No open slot on ${date} for ${packageSlug}`);

  const { data, error } = await client.rpc("create_booking", {
    p_package_id: pkg.id,
    p_starts_at: slot.starts_at,
    p_addon_ids: [],
  });
  if (error) throw error;

  const booking = data as unknown as { id: string; starts_at: string };
  return { id: booking.id, startsAt: booking.starts_at, date };
}

/** Removes a walk-in customer (no login) and everything the test made for them. */
export async function deleteCustomerByEmail(email: string) {
  const db = adminDb();
  const { data: customers } = await db.from("customers").select("id").eq("email", email);
  const ids = (customers ?? []).map((c) => c.id);
  if (!ids.length) return;

  const { data: bookings } = await db.from("bookings").select("id").in("customer_id", ids);
  const bookingIds = (bookings ?? []).map((b) => b.id);
  if (bookingIds.length) {
    await db.from("email_log").delete().in("booking_id", bookingIds);
    await db.from("payments").delete().in("booking_id", bookingIds);
    await db.from("bookings").delete().in("id", bookingIds);
  }
  await db.from("email_log").delete().in("customer_id", ids);
  await db.from("customers").delete().in("id", ids);
}

/** Removes the contact-form messages a test sent. */
export async function deleteContactMessages(email: string) {
  await adminDb().from("contact_messages").delete().eq("email", email);
}

/** A client signed in as a customer, with the same rights the browser has. */
export async function signedInClient(account: { email: string; password: string }) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword(account);
  if (error) throw error;
  return client;
}

/** A client with no sign-in at all: what a visitor's browser can do. */
export function signedOutClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** The package id and first open slot of a day, as the booking page would offer them. */
export async function firstOpenSlot(client: ReturnType<typeof signedOutClient>, packageSlug: string, date: string) {
  const { data: pkg, error } = await client.from("packages").select("id").eq("slug", packageSlug).single();
  if (error) throw error;
  const { data: slots } = await client.rpc("available_slots", { p_package_id: pkg.id, p_date: date });
  const slot = slots?.[0];
  if (!slot) throw new Error(`No open slot on ${date} for ${packageSlug}`);
  return { packageId: pkg.id, startsAt: slot.starts_at, endsAt: slot.ends_at };
}
