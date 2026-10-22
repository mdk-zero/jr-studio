import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Secret-key client for fixtures and clean-up only; the UI does the rest. */
export function adminDb() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A confirmed account with a role, created directly (staff are invited in real life). */
export async function createAccount(role: "admin" | "staff" | "customer", label: string) {
  const db = adminDb();
  const email = `e2e-${label}-${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-9aZ`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label}` },
  });
  if (error) throw error;
  if (role !== "customer") await db.from("profiles").update({ role }).eq("id", data.user.id);
  return { id: data.user.id, email, password };
}

export async function deleteAccount(id: string) {
  const db = adminDb();
  const { data: customers } = await db.from("customers").select("id").eq("profile_id", id);
  const ids = (customers ?? []).map((c) => c.id);
  if (ids.length) {
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
  await db.auth.admin.deleteUser(id);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** The first Manila date at least `days` ahead that is not a Sunday (closed). */
export function bookableDate(days: number): string {
  for (let d = days; d < days + 14; d++) {
    const date = new Date(Date.now() + 8 * 3600e3 + d * 864e5);
    if (date.getUTCDay() !== 0) return date.toISOString().slice(0, 10);
  }
  throw new Error("no open day found");
}

/**
 * Collects Content Security Policy violations the browser reports for a page,
 * so a test can assert the policy blocked nothing the app itself needs.
 */
export function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (load|execute|connect|apply|frame)/i.test(text)) violations.push(text);
  });
  return violations;
}
