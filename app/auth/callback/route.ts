import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postLoginPath, safeNextPath } from "@/lib/auth/roles";

/**
 * Handles the `?code=` style email link from Supabase's default confirmation
 * template. Signup emails now carry a 6-digit code instead (Resend SMTP and
 * the custom template went live in Phase 6), so this only serves links from
 * emails sent before the switch, and any OAuth provider added later.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    redirect("/login?error=invalid_link");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    redirect("/login?error=expired_link");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(postLoginPath(profile?.role ?? "customer", next));
}
