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

## Email

Everything goes through Resend from the studio's domain:

- **Auth email** (signup codes, password resets) is sent by Supabase over Resend
  SMTP, using the branded templates in `supabase/templates/`. Signup emails carry
  the 6-digit code `/verify` asks for.
- **App email** (booking updates, staff invites, review requests, contact-form
  notices, bulk email) is sent by `lib/email/` and logged in `email_log`.
- **`EMAIL_MODE`**: unless it is `live`, every app email goes to Resend's test
  inbox instead of the real recipient, and is logged as `test`. Staff invites in
  test mode show the admin the link to pass on by hand. Auth email is not
  affected by this setting.
- Tests never read a mailbox: they mint confirmation codes with
  `auth.admin.generateLink()`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (also type-checks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest: unit + integration |
| `npm run test:e2e` | Playwright: the full journey in a browser, plus a phone-layout check |

Unit tests are pure logic (Manila dates, pricing rules, redirect safety).
Integration tests run against the linked Supabase project using real signed-in
users, so they need `.env.local`; they share one database and therefore run
serially.

End-to-end tests run against a production build (`npm run build` first; the
config starts `next start` on port 3100). The journey signs up through the real
form (the email goes to a Resend test address), books, approves, takes payment,
cancels and undoes; the phone check loads every page at Pixel 7 size and fails on
sideways scrolling or any Content Security Policy violation. To use an installed
Chrome instead of Playwright's own, set `CHROME_PATH`; otherwise run
`npx playwright install chromium` once.

## Going live

1. **Production Supabase project** (separate from dev, where tests create and
   delete data): link it, `supabase db push`, then load `.env.local` and
   `supabase config push` for the auth settings and SMTP.
2. **Auth URLs**: set `site_url` and `additional_redirect_urls` in
   `supabase/config.toml` to the real domain (reset links use `site_url`), and
   push again.
3. **Vercel** environment variables: everything in `.env.example`, with
   `NEXT_PUBLIC_SITE_URL=https://<domain>` (this also turns on HSTS and
   `upgrade-insecure-requests`) and `EMAIL_MODE=live`. Set the function region
   next to the Supabase project.
4. **DNS**: point the domain at Vercel. Resend's records for the sending domain
   stay as they are.
5. **First admin**: sign up on the live site, then promote the account with the
   SQL above.
6. Check `/admin/settings` (studio email, hours, closed days) and invite staff
   from `/admin/staff`.

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
