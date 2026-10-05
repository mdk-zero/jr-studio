import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const secretKey = process.env.SUPABASE_SECRET_KEY!;

export const hasCredentials = Boolean(url && publishableKey && secretKey);

export type Client = SupabaseClient<Database>;

/** Bypasses RLS. Used only to set up fixtures. */
export function adminClient(): Client {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anonymous client: what an unauthenticated visitor gets. */
export function anonClient(): Client {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates a confirmed user with the given role and returns a client signed in
 * as them, so RLS is exercised exactly as it would be in the app.
 */
export async function createUser(
  role: "customer" | "staff" | "admin",
  label: string,
): Promise<{ client: Client; userId: string; email: string }> {
  const admin = adminClient();
  const email = `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Test-${Math.random().toString(36).slice(2)}-9aZ!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error) throw error;
  const userId = data.user!.id;

  if (role !== "customer") {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (roleError) throw roleError;
  }

  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { client, userId, email };
}

export async function deleteUser(userId: string) {
  const admin = adminClient();
  // Cascades to profiles; customers.profile_id is set null.
  await admin.auth.admin.deleteUser(userId);
}

/** A package slug -> id lookup, for readable assertions. */
export async function packageIdBySlug(slug: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("packages")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data.id;
}
