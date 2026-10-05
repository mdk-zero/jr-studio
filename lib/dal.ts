import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathFor, isStaffOrAdmin, type UserRole } from "@/lib/auth/roles";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

/**
 * The authorization boundary for the app.
 *
 * getClaims() verifies the JWT signature, so a forged cookie is rejected —
 * unlike getSession(), which only decodes it. The ROLE is then read from the
 * profiles table rather than a token claim: claims go stale until the token
 * refreshes (up to an hour), and demoting or deactivating someone has to take
 * effect immediately.
 *
 * Wrapped in React cache() so repeated calls within one render reuse the result
 * instead of re-querying per component.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
});

/** Any signed-in user, or bounce to login carrying the attempted path. */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return user;
}

/** Staff or admin. A customer is sent to their own area, not to login. */
export async function requireStaff(nextPath?: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (!isStaffOrAdmin(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** Admin only: catalog, staff management, settings, deletes. */
export async function requireAdmin(nextPath?: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") redirect(homePathFor(user.role));
  return user;
}

/** The customers row for the signed-in user, if they have one. */
export const getCurrentCustomerId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
});
