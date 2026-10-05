import { Suspense } from "react";
import { publicEnv } from "@/lib/env";

/**
 * Phase 0 placeholder. The real landing page arrives in Phase 3, once the
 * catalog exists and can be read through a cached query.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div>
        <p className="text-sm font-medium tracking-[0.2em] text-burgundy-500 uppercase">
          J&amp;R Studio
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-burgundy-700 sm:text-5xl">
          Foundation in place
        </h1>
        <p className="mt-4 max-w-prose text-muted">
          Next.js 16 with the backend inside the app, Supabase for data, auth and
          storage. Brand tokens, Manila-safe date helpers and peso formatting are
          wired up. Next: the database schema.
        </p>
      </div>

      <section className="rounded-xl border border-sand-300 bg-white/70 p-6">
        <h2 className="text-lg font-semibold text-ink">Environment</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Supabase project</dt>
            <dd className="font-mono text-ink">
              {new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Connection</dt>
            <dd>
              <Suspense fallback={<span className="text-muted">checking…</span>}>
                <SupabaseStatus />
              </Suspense>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

/**
 * Deliberately uncached, so it streams in behind Suspense rather than being
 * baked into the prerendered shell — the Cache Components pattern this app
 * uses for every request-time read.
 */
async function SupabaseStatus() {
  let ok = false;
  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      // Supabase rejects unkeyed requests with a 401, so send the publishable key.
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    ok = res.ok;
  } catch {
    ok = false;
  }

  return ok ? (
    <span className="font-medium text-burgundy-600">reachable</span>
  ) : (
    <span className="font-medium text-red-700">unreachable</span>
  );
}
