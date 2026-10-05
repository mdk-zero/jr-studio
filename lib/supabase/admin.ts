import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Secret-key client. BYPASSES RLS — use only where the user's own privileges
 * genuinely cannot do the job (inviting staff logins, sending queued email).
 * Every caller must do its own authorization check first (see lib/dal.ts).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
