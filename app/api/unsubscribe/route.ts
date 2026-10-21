import type { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * RFC 8058 one-click unsubscribe. Mail apps POST here when someone presses
 * the "Unsubscribe" button next to the sender name; the List-Unsubscribe
 * header on each bulk email points at this URL. Only POST changes anything.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const { data, error } = await createPublicClient().rpc("unsubscribe_marketing", { p_token: token });

  if (error || !data) return new Response("Unknown token", { status: 404 });
  return new Response("Unsubscribed", { status: 200 });
}
