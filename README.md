# J&R Studio

Studio management for J&R Studio (Nasugbu, Batangas): a public site where customers
browse packages and book sessions, plus a back office for bookings, customers,
catalog, portfolio, staff and testimonials.

A rebuild of a PHP/MySQL system, now Next.js 16 (App Router, backend in the same
app) on Supabase for Postgres, Auth and Storage. Prices are in PHP (₱) and all
scheduling is in `Asia/Manila`.

## Requirements

- Node.js 22+
- A Supabase project (the CLI is used against the hosted project; Docker is not required)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

`.env.local`:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys (publishable) |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys (secret). Server-only — never prefix with `NEXT_PUBLIC_` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `STUDIO_NOTIFY_EMAIL` | Resend (transactional email) |
| `RESEND_SMTP_KEY` | Resend → API Keys → *Sending access*, limited to the studio domain. Supabase Auth's SMTP password; needed only for `supabase config push` |
| `EMAIL_MODE` | `live` delivers email. Anything else (the default) sends every message to Resend's test inbox, so a dev database never emails real people |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` in development |

## Database

Migrations and the dev seed live in `supabase/`. The schema is applied to the
linked project with the CLI:

```bash
supabase link                        # once, select the project
supabase db push                     # apply migrations
supabase db push --include-seed      # apply migrations + reset the dev seed
supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts
supabase db advisors                 # security + performance lint
# Auth settings. Load .env.local first: the SMTP password is env(RESEND_SMTP_KEY),
# and pushing without it would blank the password and stop signup emails.
# The push does not ask for confirmation when run non-interactively.
set -a; . ./.env.local; set +a
supabase config push                 # apply supabase/config.toml (auth settings) to the project
```

The seed truncates the app tables before inserting, so it is safe to re-run. It
never touches `auth.users`.

### Creating the first admin

Everyone who signs up is a `customer`. Promote yourself once, in the Supabase SQL
editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

After that, admins invite staff from `/admin/staff` and no one needs SQL again.
Roles are read live from `profiles` on every request, so a change takes effect
immediately rather than when the user's token happens to refresh.

## Email in development

Supabase's built-in email provider is rate limited (a couple of messages an hour)
and **cannot use custom templates on the free tier**, so:

- Signup confirmation currently arrives as a **link**, handled by
  `/auth/callback`. The 6-digit code field on `/verify` works the moment a custom
  template is live.
- The branded templates are written and waiting in `supabase/templates/`. Enable
  them by configuring Resend as custom SMTP and uncommenting
  `[auth.email.template.*]` in `supabase/config.toml`, then `supabase config push`.
- Tests avoid sending email entirely: they mint confirmation codes with
  `auth.admin.generateLink()`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (also type-checks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest: unit + integration |

Unit tests are pure logic (Manila dates, pricing rules, redirect safety).
Integration tests run against the linked Supabase project using real signed-in
users, so they need `.env.local`; they share one database and therefore run
serially.

## Architecture notes

- **Authorization** lives in `lib/dal.ts`. `getCurrentUser()` verifies the JWT with
  `getClaims()` (not `getSession()`, which only decodes the cookie) and reads the
  role from `profiles`. `proxy.ts` only does an optimistic redirect; it is never
  the security boundary.
- **Four Supabase clients**, each with one job: `client.ts` (browser),
  `server.ts` (cookie-based, RLS as the user), `public.ts` (cookie-less, safe
  inside `use cache`), `admin.ts` (secret key, bypasses RLS — authorize first).
- **Booking rules live in the database.** `quote_booking()` is the only pricing
  formula, `available_slots()` the only availability source, and `create_booking()`
  writes atomically. A `tstzrange` exclusion constraint makes double-booking
  impossible rather than unlikely.
- **Cache Components** is on. Public pages cache with `use cache` + `cacheTag`;
  authenticated areas set `instant = false` and render per request.
