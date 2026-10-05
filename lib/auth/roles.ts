import type { Database } from "@/lib/supabase/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

/** Staff and admins share the back office; customers get their own area. */
export function homePathFor(role: UserRole): string {
  return role === "customer" ? "/account" : "/admin";
}

export function isStaffOrAdmin(role: UserRole | null | undefined): boolean {
  return role === "staff" || role === "admin";
}

/**
 * Validates a `?next=` value before redirecting to it.
 *
 * Only same-site absolute paths are allowed. Anything protocol-relative
 * ("//evil.com", "/\\evil.com") or absolute ("https://evil.com") is rejected,
 * because Supabase redirects and login links both carry this value and an open
 * redirect would let a phishing page wear this site's login flow.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  // Reject "//host" and "/\host", which browsers treat as protocol-relative.
  if (/^[/\\]{2}/.test(next)) return null;
  // Reject control characters and whitespace used to smuggle a scheme.
  if (/[\s\u0000-\u001f]/.test(next)) return null;
  return next;
}

/**
 * Where to send someone after signing in: their requested destination when it
 * is safe and their role can use it, otherwise their role's home.
 */
export function postLoginPath(role: UserRole, next?: string | null): string {
  const target = safeNextPath(next);
  if (!target) return homePathFor(role);
  // A customer following a stale link into /admin would only hit a redirect, so
  // send them somewhere useful instead.
  if (target.startsWith("/admin") && !isStaffOrAdmin(role)) return homePathFor(role);
  return target;
}
