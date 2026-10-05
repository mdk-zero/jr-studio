import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postLoginPath, safeNextPath } from "@/lib/auth/roles";

/**
 * Handles the `?code=` style email link, which is what Supabase's DEFAULT
 * confirmation template produces. Until custom templates are available (they
 * need Resend SMTP), signup confirmation arrives as a link rather than a
 * 6-digit code, so this is the path that actually runs today.
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
