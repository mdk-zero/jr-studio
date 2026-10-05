import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cookie-less client for public, cacheable reads (catalog, portfolio,
 * approved testimonials, studio settings). Safe inside `use cache` precisely
 * because it never touches cookies, so nothing user-specific can leak into a
 * shared cache entry. Reads as the `anon` role, so RLS still applies.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
