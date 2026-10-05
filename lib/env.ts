import { z } from "zod";

/**
 * Fail fast on misconfiguration instead of surfacing confusing runtime errors
 * from the Supabase client. Only NEXT_PUBLIC_* vars may be read in the browser.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

/** Server-only secrets. Call this from server code only. */
export function serverEnv() {
  return z
    .object({
      SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is not set"),
    })
    .parse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}
