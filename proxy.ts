import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/** Paths that require a session. Role checks happen in lib/dal.ts, not here. */
const PROTECTED = ["/admin", "/account", "/book"];

/**
 * Next 16 renamed Middleware to Proxy. Its only jobs here:
 *  1. refresh the Supabase auth token and pass the new cookies both ways
 *  2. an *optimistic* redirect for signed-out users hitting protected paths
 *
 * This is deliberately NOT the authorization boundary: a cookie can be forged,
 * so every page/action re-verifies via getClaims() in the Data Access Layer.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Verifies the JWT signature and refreshes it when needed.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (needsAuth && !data?.claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    // Carry over any refreshed auth cookies so the redirect doesn't drop them.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|ico|woff2?)$).*)",
  ],
};
