# J&R Studio — Migration Plan: adminMergedv1.3 (PHP/MySQL) → jr-studio (Next.js 16 + Supabase)

## Context

`~/Projects/adminMergedv1.3` is a XAMPP-era PHP 8.2 / MariaDB 10.4 system for a photo studio
("J&R Studio", Nasugbu, Batangas — ₱ PHP, Asia/Manila): an admin panel (dashboard, bookings,
portfolio, services/packages/add-ons/promos, clients, staff, testimonials) plus a customer landing
site (browse packages, sign up, book, view booking history).

It works, but it has grown organically and the structure is now the problem:

- **No authentication anywhere except one page.** Every `php/*` JSON endpoint is open. Anyone can
  POST `php/staff.php action=add_staff` (or `Landing/login/signup.php`) and get a working admin
  account; `process_booking.php` trusts a posted `client_id`, so anyone can book as anyone and
  overwrite that client's profile.
- **Two parallel catalogs that can't see each other.** Customers book `photoshoot_packages`; the
  admin wizard books `services`. Add-ons/promos only attach to services. `bookings` has no
  `package_id`, so a customer booking records its package as text in `notes` — and because the admin
  availability query joins `booking_services`, **admin can double-book over every customer booking**.
- **Four different price formulas** that disagree on add-ons, promos, and discounts;
  `final_price` is `decimal(10,0)`, a stale snapshot never recomputed when promos start or end.
- **Nothing is ever written to `payments`**, so dashboard revenue and "total spent" are always 0,
  and the dashboard renders `$` instead of ₱.
- **Half-finished flows:** reschedule modal is a 0-byte file, package cards have no edit/delete,
  testimonial review/reject/request-feedback buttons have no handlers, the contact form posts to
  nowhere, email verification was never built, `payments`/`booking_addons`/`staff` are never written.
- Other structural debt: 3 DB connection files (`root`, empty password), images as LONGBLOB
  base64-inlined twice per page, free-text durations (`"1.5 hours"` parsed as **15 hours**),
  `toISOString()` date shifts that book the wrong day in UTC+8, pending bookings expiring only when
  an admin happens to load a page, a hardcoded Gmail app password, stored XSS via `innerHTML`,
  N+1 queries, client-side-only pagination (12 rows), runtime `ALTER TABLE`, and hard deletes that
  orphan bookings.

`~/Projects/jr-studio` is a fresh `create-next-app` scaffold: Next 16.3.5, React 19.2, Tailwind 4,
TypeScript strict, App Router, alias `@/*`. One commit, nothing built yet.

**Intended outcome:** one typed codebase where the backend lives inside Next.js (Server Actions +
Route Handlers, Node runtime) on Supabase (Postgres + Auth + Storage + Cron); every business rule
worth keeping is preserved, each class of bug above is designed out, and the two booking paths become
one consistent flow.

### Decisions made with the user
- **Backend inside Next.js** — no separate Express server.
- **Fresh start** — new clean schema + seed script. The legacy dump is a spec only; no ETL.
- **Existing hosted Supabase project** (no Docker locally → `supabase link` + `db push`; CLI 2.117).
- **Full UI redesign** — old screens are a feature spec, not a visual reference.
- **One unified catalog** — categories → packages (bookable); add-ons and promos attach to packages.
- **One session at a time, studio-wide** — enforced by a Postgres exclusion constraint.
- **Manual payment ledger** — admin records cash/GCash/bank; status derived. PayMongo can come later.
- **Resend** for transactional email + as Supabase Auth custom SMTP.

### Verified environment facts (don't re-derive)
- Next 16: `middleware.ts` → **`proxy.ts`**; `cookies()`/`headers()`/`params`/`searchParams` are
  **async-only**; `revalidateTag(tag, 'max')` needs a cacheLife profile; `updateTag()`/`refresh()`
  exist for Server Actions; `cacheComponents: true` turns on `use cache`/`cacheTag` + PPR and
  requires Node runtime (a `use cache` function cannot call `cookies()`).
- Supabase: `@supabase/supabase-js` + `@supabase/ssr`; env `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable, not "anon"); refresh the session in
  `proxy.ts` via `getClaims()`; protect pages with **`getClaims()`**, never `getSession()`.
- **Breaking (enforced 2026-10-30): new tables are NOT auto-exposed to the Data API.** Every
  migration must `GRANT` explicitly to `anon`/`authenticated` *and* enable RLS.
- Signup verification as a 6-digit code: put `{{ .Token }}` in the Confirm-signup template, verify
  with `verifyOtp({ email, token, type: 'email' })`.
- Role claims from a custom access token hook go **stale until token refresh** → authorization reads
  the live `profiles.role` (so deactivating staff takes effect immediately).

## Architecture

| Concern | Choice |
|---|---|
| Rendering | RSC by default; `cacheComponents: true`. Public pages cached with `use cache` + `cacheTag`; admin/account areas dynamic, session reads behind `<Suspense>` |
| Writes | Server Actions, Zod-validated, server recomputes every price |
| Route Handlers | only where a non-RSC caller needs them: `/api/availability`, `/auth/confirm`, CSV export |
| Reads | supabase-js with the user's session → **RLS enforced**. Public catalog via a cookie-less publishable-key client inside `use cache` |
| Secret key | server-only (`lib/supabase/admin.ts`), for auth admin ops (invite staff) and email jobs only |
| Authorization | `lib/dal.ts`: `import 'server-only'` + React `cache()`-wrapped `verifySession()`/`requireAdmin()`. Checked in the admin layout **and** in every action — never only in `proxy.ts` |
| Atomicity | booking creation/reschedule in one Postgres function; `23P01` (exclusion violation) → "slot was just taken" |
| Single source of truth | `public.quote_booking()` for price, `public.available_slots()` for slots — one formula, called by both preview and write path |
| Scheduling | pg_cron expires past pending bookings every 15 min (not on page load) |
| Money | `numeric(10,2)` everywhere, ₱ via `Intl.NumberFormat('en-PH')` |
| Time | `timestamptz` for instants; business hours as `time` + weekday, interpreted in `Asia/Manila` in one `lib/datetime.ts`. No `toISOString()` date math |

## Schema (`supabase/migrations/`)

Extensions: `pgcrypto`, `btree_gist` (needed for `staff_id =` in an exclusion constraint), `pg_cron`.
Enums: `user_role(admin,staff,customer)`, `booking_status(pending,approved,completed,cancelled,rejected,expired)`,
`payment_method(cash,gcash,bank_transfer,card,other)`, `staff_position(photographer,videographer,makeup_artist,assistant,editor,other)`,
`customer_tier(regular,vip,corporate)`, `testimonial_status(pending,approved,rejected)`, `entity_status(active,inactive)`.

**Identity**
- `profiles` — `id uuid PK → auth.users ON DELETE CASCADE`, full_name, email, phone, `role user_role NOT NULL DEFAULT 'customer'`, avatar_path, timestamps.
- `customers` — id, `profile_id uuid UNIQUE NULL → profiles`, full_name, `email citext UNIQUE NULL`, phone, address, tier, status, timestamps. **Nullable profile_id = walk-in** created by admin; claimed on signup when a verified email matches.
- `customer_notes` — id, customer_id (cascade), author_id, body, created_at. *(Replaces appending lines to one `notes` TEXT column.)*
- `staff_members` — id, `profile_id UNIQUE NULL → profiles` (only if they can log in), full_name, email, phone, address, position, birthday, hire_date, status, show_on_about, bio, photo_path, sort_order.

**Catalog**
- `categories` — id, slug UNIQUE, name, description, cover_path, sort_order, is_active.
- `packages` — id, category_id (restrict), slug UNIQUE, name, description, `price numeric(10,2) CHECK >= 0`, **`duration_minutes int CHECK > 0`**, `inclusions text[]`, outfits, backdrops, photos_included text, magazine_cover bool, digital_images bool, cover_path, is_active, sort_order, timestamps.
- `package_images` — id, package_id (cascade), storage_path, alt, sort_order.
- `addons` — id, name, description, `price numeric(10,2)`, is_active.
- `package_addons` — PK(package_id, addon_id), both cascade.
- `promotions` — id, name, `discount_percent int CHECK BETWEEN 1 AND 100`, starts_on, ends_on, `CHECK (ends_on >= starts_on)`, visible_to_customers, timestamps. **No stored status column.**
- `promotion_packages` — PK(promotion_id, package_id).
- `promotions_with_status` — view, `security_invoker = true`, status computed from `(now() AT TIME ZONE 'Asia/Manila')::date` (end date inclusive, as legacy).

**Bookings**
- `bookings` — id, `reference text UNIQUE` (`JR-2026-0001`), customer_id (restrict), package_id (restrict), `staff_id NULL` (set null), `starts_at timestamptz`, `ends_at timestamptz CHECK (ends_at > starts_at)`, `slot tstzrange GENERATED ALWAYS AS tstzrange(starts_at, ends_at, '[)') STORED`, status, `package_price`, `addons_total`, `discount_amount`, `total_amount`, promotion_id (set null), notes, `source text CHECK IN ('customer','admin')`, created_by, `cancelled_at`, `status_before_cancel`, timestamps.
  - `EXCLUDE USING gist (slot WITH &&) WHERE (status IN ('pending','approved','completed'))` → **one session at a time**.
  - `EXCLUDE USING gist (staff_id WITH =, slot WITH &&) WHERE (staff_id IS NOT NULL AND status IN (...))` → no staff double-booking.
  - Indexes on `(starts_at)`, `(status, starts_at)`, `(customer_id, starts_at DESC)`.
- `booking_addons` — id, booking_id (cascade), addon_id (restrict), `quantity int CHECK > 0`, **`unit_price` snapshot**, UNIQUE(booking_id, addon_id).
- `booking_events` — id, booking_id (cascade), actor_id, type, from_status, to_status, note, created_at. *(Audit timeline; replaces "(System Approved)" / "(Cancelled by customer …)" string-appending.)*
- `payments` — id, booking_id (cascade), `amount numeric(10,2) CHECK (amount <> 0)` (negative = refund), method, reference_no, receipt_path, paid_at, recorded_by, note.
- `booking_payment_summary` — view (`security_invoker`): booking_id, paid_total, balance, and **derived** `payment_status` (unpaid / partial / paid / refunded).

**Content & ops**
- `albums`, `portfolio_photos` (album_id set null, package_id set null, category_id, storage_path, width, height, sort_order).
- `testimonials` — customer_id, booking_id, package_id, `rating int CHECK 1..5`, message, status, **`is_featured bool`** (a flag, not a status value), admin_notes, reviewed_at/by.
- `feedback_requests` — booking_id, token, sent_at, completed_at.
- `contact_messages` — name, email, phone, message, is_read, created_at.
- `email_log` — to_email, subject, template, status, provider_id, error, created_at.
- `studio_settings` — single row (`id bool PK DEFAULT true CHECK (id)`): studio name/phone/email/address/map_url, socials jsonb, `slot_interval_minutes` (60), `min_lead_hours` (24), `max_advance_days` (90), `cancel_cutoff_hours`, `undo_window_seconds` (300), currency, timezone.
- `business_hours` — weekday 0–6 PK, is_open, opens_at, closes_at (legacy: 08:00–20:00).
- `blocked_dates` — date PK, reason.

**`private` schema** (not exposed; `SECURITY DEFINER` lives only here, each with its own auth check):
`is_admin()`, `is_staff_or_admin()`, `current_customer_id()`, `set_updated_at()` trigger,
`handle_new_user()` (on `auth.users` insert → create profile, claim a walk-in `customers` row by verified email, else create one),
`expire_pending_bookings()` (pg_cron every 15 min), `next_booking_reference()`.

**Public RPCs** (`SECURITY INVOKER`, so RLS still applies):
- `public.quote_booking(p_package_id, p_addon_ids uuid[])` → package_price, addons_total, promotion_id, discount_amount, total. **The one pricing formula:** `subtotal = package.price + Σ(addon.price × qty)`; apply the **single highest** promo that is active today in Manila and linked to that package; `total = round(subtotal × (1 - pct/100), 2)`.
- `public.available_slots(p_package_id, p_date)` → slot starts, from business hours ∩ settings (lead time, max advance) − blocked dates − overlapping active bookings, stepped by `slot_interval_minutes`, only where the whole duration fits before closing.
- `public.create_booking(...)` / `public.reschedule_booking(...)` — insert booking + booking_addons + event in one transaction, price from `quote_booking` (client amounts never trusted).

## RLS matrix

Every table: `ENABLE ROW LEVEL SECURITY` + explicit `GRANT` (the 2026-10-30 change). Policies use
`TO anon/authenticated` **plus** a predicate — never `TO authenticated` alone. UPDATE policies get
both `USING` and `WITH CHECK`.

| Table | anon | customer | staff | admin |
|---|---|---|---|---|
| categories, packages, package_images, addons, package_addons | SELECT where `is_active` | same | SELECT all | ALL |
| promotions(+_packages) via view | SELECT where visible & active | same | SELECT all | ALL |
| portfolio_photos, albums | SELECT | SELECT | SELECT | ALL |
| testimonials | SELECT approved | SELECT approved + own; INSERT own for own completed booking | SELECT all | ALL |
| profiles | — | SELECT/UPDATE own (role **not** self-updatable) | SELECT all | ALL |
| customers | — | SELECT/UPDATE own row | SELECT, UPDATE | ALL |
| customer_notes | — | — | SELECT, INSERT | ALL |
| staff_members | SELECT where `show_on_about` | same | SELECT all | ALL |
| bookings | — | SELECT own; INSERT own (via RPC); UPDATE own only to cancel/undo | SELECT all, UPDATE status/staff | ALL |
| booking_addons / booking_events | — | SELECT own | SELECT, INSERT | ALL |
| payments | — | SELECT own (read-only) | SELECT, INSERT | ALL |
| contact_messages | INSERT only | INSERT | SELECT, UPDATE is_read | ALL |
| studio_settings, business_hours, blocked_dates | SELECT | SELECT | SELECT | ALL |
| email_log, feedback_requests | — | — | SELECT | ALL |

Staff = day-to-day operations (calendar, bookings, customers, payments, moderation).
Admin = everything, plus catalog, staff management, settings, deletes, bulk email.

## Route map

```
app/
  (marketing)/ layout · page · packages/[slug] · portfolio · about · contact
  (auth)/ login · signup · verify · forgot-password · reset-password
  (account)/account/ layout · bookings · bookings/[id] · profile · testimonials
  book/ page (wizard: package → add-ons → date/slot → review)
  admin/ layout (sidebar + requireAdmin/requireStaff)
    page (dashboard) · bookings (calendar+list) · bookings/[id]
    catalog/{categories,packages,packages/[id],addons,promos}
    portfolio · customers · customers/[id] · staff · testimonials
    payments · messages · settings
  api/availability/route.ts · auth/confirm/route.ts · api/export/[entity]/route.ts
proxy.ts                      # getClaims() session refresh + optimistic redirects
lib/ supabase/{client,server,admin,database.types}.ts · dal.ts · validators/ ·
     pricing.ts · availability.ts · datetime.ts · email/{resend,templates}/ · storage.ts
components/ ui/ (shadcn) · marketing/ · booking/ · admin/
supabase/ migrations/ · seed.sql
```

## Server Action inventory (all Zod-validated; auth noted)

- **auth**: `signUp`, `verifyEmailOtp`, `signIn`, `signOut`, `requestPasswordReset`, `resetPassword`, `updateProfile` *(own)*
- **booking (customer)**: `quote` (RPC passthrough), `createBooking`, `cancelBooking`, `undoCancelBooking`, `submitTestimonial` *(own, completed booking)*
- **admin bookings**: `createWalkInBooking` (auto-approved), `approve`, `reject` (blocked once approved), `cancel`, `complete` (blocked for future), `reschedule`, `assignStaff`, `updateNotes`, `deleteBooking` *(admin)*
- **payments**: `recordPayment`, `voidPayment` *(admin)*
- **catalog** *(admin)*: category/package/addon/promo CRUD, `togglePackageActive`, `reorder`, `uploadPackageImage`, `deletePackageImage`
- **portfolio** *(staff+)*: `uploadPhotos` (multi; auto-create album), `updatePhoto`, `updateAlbum`, `deletePhoto`/`deleteAlbum` (also delete Storage objects), `bulkDelete`
- **customers**: `createWalkIn`, `update`, `changeTier`, `addNote`, `deactivate` (soft), `sendBulkEmail` *(admin; Resend batch + email_log, idempotent)*
- **staff** *(admin)*: `create`, `update`, `deactivate`, `inviteLogin` (secret-key `inviteUserByEmail`), `setRole`
- **testimonials** *(staff+)*: `approve`, `reject`, `toggleFeatured`, `edit`, `delete`, `requestFeedback`
- **content** *(admin)*: `updateSettings`, `updateBusinessHours`, `blockDate`/`unblockDate`, `markMessageRead`
- **public**: `submitContactMessage` (rate-limited)

Every catalog/portfolio/testimonial/settings write ends with `updateTag('catalog'|'portfolio'|'testimonials'|'settings')`.

## Phases (each ends in something demonstrable)

0. **Foundation** — deps (`@supabase/supabase-js @supabase/ssr zod resend react-email date-fns @tanstack/react-table`, shadcn init, vitest/playwright); `cacheComponents: true`; `.env.local` + `.env.example`; `lib/supabase/*`; `proxy.ts`; `lib/datetime.ts`; brand tokens in `globals.css` (burgundy `#662d38`, beige `#f5f1ee`, Playfair Display + DM Sans); app shell. → `/` renders themed, Supabase connects.
1. **Schema** — `supabase init` + `link`; migrations (extensions → enums → tables → views → private fns → RPCs → RLS+GRANTs → cron); `supabase db push`; `supabase gen types typescript --linked`; `seed.sql`. → tables live, advisors clean.
2. **Auth** — signup with 6-digit OTP, login, reset, `handle_new_user` + walk-in claim, `lib/dal.ts`, role-based landing, `/auth/confirm`. → all three roles log in and land correctly.
3. **Catalog** — admin CRUD + Storage uploads; public packages/portfolio/testimonials cached with `cacheTag`, invalidated by `updateTag`. → edit in admin, see it live.
4. **Booking** — `available_slots` + `/api/availability`, wizard with `?package=slug` preselect, `quote_booking` preview, `create_booking`, 23P01 handling, My Bookings + cancel/undo. → customer books; a double-book attempt fails cleanly.
5. **Admin bookings + payments** — calendar/list, status actions, reschedule, assign staff, walk-in wizard, payment ledger with derived status, booking timeline. → approve → record payment → status flips to paid.
6. **People & content** — customers (server-side paging/filters), notes, staff + invites, testimonial moderation + feedback requests, contact inbox, bulk email.
7. **Dashboard** — KPIs from the real ledger (₱), bookings by status, 12-month revenue, recent/upcoming (pending+approved only, by start time), top packages (excluding cancelled).
8. **Hardening & deploy** — rate limits, CSP, `supabase db advisors`, legacy asset compression (91 MB of 10–19 MB mp4s / 6–8 MB PNGs → webp/avif + re-encoded video), Resend domain + Supabase custom SMTP, Vercel env + Auth redirect URLs, README.

## Verification

- `supabase db push` then `supabase db advisors` (CLI 2.81.3+) → no security findings.
- **Unit (Vitest)**: `pricing.ts` (best-single-promo, inclusive end date, add-on totals), `availability.ts` (closing-time fit, blocked dates, lead time, max advance), `datetime.ts` (Manila ↔ UTC round-trips — the legacy `toISOString()` off-by-one must fail these).
- **DB integration (TS, two signed-in clients)** — no Docker, so run against the hosted dev project instead of `supabase test db`: customer A cannot read B's bookings/payments; anon cannot read `customers`; a customer cannot self-promote to admin; overlapping insert raises `23P01`; staff cannot touch catalog.
- **E2E (Playwright)**: signup → OTP verify → book → admin approve → record payment → paid badge → cancel + undo window.
- Manual: `npm run build` clean; dashboard totals match seeded payments; a package edit shows on `/` within one request (`updateTag`).

## Business rules: preserved vs changed

**Preserved** — hourly slots 08:00–20:00 (now configurable); admin-created bookings auto-approved; approved bookings can only be cancelled, never rejected; future bookings can't be completed; past pending → expired; promo end date inclusive; 5-minute cancel undo; booking approval is manual; ₱/en-PH; legacy categories carried over as rows (Concept Shoot, Prenup, Family, Self Portrait, Baby, Wedding, Corporate, Debut, Birthday).

**Changed deliberately** — one catalog instead of two; one pricing formula instead of four; durations in **minutes** (fixes `"1.5 hours"` → 15 h); expiry by **cron**, not page load; promo status **computed**, never stored; payment status **derived** from a real ledger; undo state in the DB, not a PHP session (and re-checked by the exclusion constraint); audit events instead of appended note text; soft-deactivate instead of hard deletes; images in Storage, not blobs; server-side paging/search; staff separated from login accounts (`staff_members` + optional `profile_id`), replacing the `users`/`admins`/`staff`/`clients` tangle.

## Open items
- Hero slides: manage in DB or keep as static assets (decide in Phase 3).
- Legacy `carousel_images`, `website_analytics`, `portfolio_projects/_media`, `client_feedback` are dead — intentionally dropped.
- First admin: sign up normally, then flip `profiles.role` to `admin` via one SQL statement (documented in README); subsequent admins via staff invite.

---

## Progress

### Phase 0 — Foundation ✅ (2026-10-05)
Done: deps installed; **Next upgraded 16.3.5 → 16.3.8** (16.3.5 had a critical RCE in `next/og`);
`@types/node` → ^22 (vitest 5 peer requirement); `cacheComponents: true` + Supabase image
`remotePatterns`; `lib/env.ts` (Zod-validated, server secrets separated); four Supabase clients
(`client` / `server` / `public` cookie-less for `use cache` / `admin` secret-key, all `server-only`
where applicable); `proxy.ts` (getClaims refresh + optimistic redirect, cookies carried onto the
redirect); `lib/datetime.ts` (Manila wall-clock helpers) + `lib/money.ts` (one ₱ formatter);
brand tokens in `globals.css`; Playfair/DM Sans in layout; placeholder `/`; vitest + 12 passing
datetime tests; `.env.local` (real keys) + tracked `.env.example`.

Verified: `tsc --noEmit` clean · `npm run lint` clean · 12/12 tests · `npm run build` clean with
`/` as ◐ Partial Prerender and Proxy registered · dev server serves `/` with Supabase "reachable" ·
`/admin` and `/account` 307 → `/login?next=…`.

Notes carried forward:
- Supabase is linked to the hosted dev project (`supabase link`); publishable key is in `.env.local`.
- `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `STUDIO_NOTIFY_EMAIL` are still blank — needed from
  Phase 6/8 (staff invites, email), not before.
- 5 remaining `npm audit` highs are dev-only ESLint transitives (`braces`/`micromatch`/`fast-glob`);
  npm's only "fix" is a downgrade to eslint-config-next@14, so they stay.
- Supabase health endpoint needs an `apikey` header (an unkeyed probe returns 401).

### Phase 1 — Schema ✅ (2026-10-05)
15 migrations pushed to the linked dev project (DB confirmed empty first: 0 tables, no history).
24 tables + 2 views + 5 RPCs; types generated to `lib/supabase/database.types.ts` and wired into all
four clients. Seeded: 9 categories, 13 packages, 6 add-ons, 3 promotions, 6 staff, 6 customers,
10 bookings across every status, 6 payments, 3 testimonials.

Advisors: **0 errors**, 10 → 7 warnings (the 7 are intentional: `available_slots` + the 3 booking
RPCs must be SECURITY DEFINER and carry their own auth checks, plus Supabase's own
`public.rls_auto_enable`).

Four problems found and fixed during verification — each one a bug, not a preference:
1. **Booking RPCs were callable by `anon`.** Revoking from `PUBLIC` was not enough; Supabase grants
   EXECUTE to `anon` *directly*, so `cancel_booking` still reached its function body with only the
   publishable key. Fixed by revoking from `anon` explicitly (migration `revoke_anon_booking_rpcs`).
   Found by calling the endpoint, not by trusting the advisor.
2. **Private tables returned `[]` instead of "permission denied"** for `anon` — RLS was filtering,
   but default privileges meant RLS was the *only* barrier. Narrowed anon to least privilege
   (`tighten_anon_privileges`), so a future policy mistake cannot expose data on its own.
3. **Pre-confirmed users never got a `customers` row.** `handle_email_confirmed` only fired on the
   null → not-null UPDATE, so admin-created users, invited staff and (later) OAuth signups got a
   profile but could not book. Extracted `private.link_customer()`, called from both triggers.
4. **`bookings.reference` was NOT NULL with no default**, filled by a trigger, so generated types
   demanded it on every insert. Replaced with a column default and dropped the trigger.

Verified: 39/39 tests (12 unit datetime + 10 pricing/availability + 17 RLS/booking) · `tsc` clean ·
lint clean · `npm run build` clean. The integration suite proves, as real signed-in users:
double-booking rejected with `23P01`; direct `bookings` insert refused (the legacy price-tampering
hole); self-promotion to admin blocked; cross-customer booking/payment isolation; staff cannot edit
the catalog; anon denied private tables; only approved testimonials and active promos are public;
cancel frees the slot and undo restores it. Derived payment status produces paid / partial / unpaid /
refunded, and promo status computes expired / active / upcoming.

Notes carried forward:
- `.env.local` now holds the real `SUPABASE_SECRET_KEY` (gitignored); `RESEND_API_KEY` still blank.
- Integration tests need `.env.local` and run against the shared dev project with
  `fileParallelism: false` (they would otherwise collide on the studio-wide exclusion constraint).
- pg_cron job `expire-pending-bookings` (*/15) was created by a clean migration; its run history
  still needs eyeballing in Dashboard → Integrations → Cron (no local psql to query `cron.job`).
- `supabase db dump` / `db reset` / `test db` need Docker and are unavailable; `db push`,
  `db push --include-seed`, `gen types`, `inspect` and `advisors` all work against the linked project.
- Seed truncates and re-inserts, so it is safe to re-apply: `supabase db push --include-seed`.

### Phase 2 — Auth ✅ (2026-10-05)
Auth config is now code: `supabase config pull` first (so config.toml matched reality and a push
could not silently change MFA/pooler/storage settings), then 4 properties pushed — 6-digit OTP,
`http://localhost:3000/**` redirects, `minimum_password_length = 8`,
`password_requirements = lower_upper_letters_digits` (legacy had no password rules at all).
Config diff is now 0.

Built: `lib/dal.ts` (`getCurrentUser` via `getClaims()` + live `profiles.role`, React `cache()`-wrapped;
`requireUser`/`requireStaff`/`requireAdmin`), `lib/auth/roles.ts` (pure `homePathFor`/`postLoginPath`/
`safeNextPath`), `lib/validators/auth.ts` (Zod), 7 server actions, `/auth/confirm` (token_hash) and
`/auth/callback` (code), 5 auth pages + forms, guarded `/admin` and `/account` shells, README.

**Blocker found:** custom email templates are **not available on the free tier with the default email
provider** — `config push` fails with "Email template modification is not available for free tier
projects". So the branded 6-digit template cannot ship yet. The templates are written and waiting in
`supabase/templates/`, commented out in config.toml. Consequence: signup confirmation currently
arrives as a **link** (handled by `/auth/callback`); the 6-digit field on `/verify` is built and works
the moment Resend SMTP is live (Phase 8). Supabase's default provider is also rate limited to ~2
emails/hour, so tests mint codes with `auth.admin.generateLink()` instead of sending mail.

Also hit: Cache Components refused to prerender `/account` (session read outside `<Suspense>`).
Fixed with `export const instant = false` on the three gated layouts, which is the documented
blocking-route escape hatch — an authenticated page has no useful static shell.

Verified: 55/55 tests (20 unit, 35 integration) · typecheck/lint/build clean. New coverage proves a
walk-in is **not** claimed until the email is confirmed (so signing up with someone else's address
cannot inherit their bookings), it **is** claimed on confirmation with no duplicate row, the role is
forced to `customer` regardless of submitted metadata, sign-in is refused until confirmed, the pushed
password policy is enforced, and the OTP is 6 digits. A separate HTTP check with real signed-in
sessions (cookies serialized by `@supabase/ssr` itself) confirms every role gate: customer→/admin
redirects to /account, staff/admin reach /admin, anon→/admin goes to /login?next=, and signed-in users
are bounced off /login.

Deferred: page-level e2e of the full signup→book→approve journey needs Playwright (Phase 8); the
`instant = false` layouts can be revisited then if any of them should stream instead of block.

### Phase 3 — Catalog + public site ✅ (2026-10-05)
Public: `lib/catalog.ts` (all reads `use cache` + `cacheTag`, cookie-less client, prices from
`quote_booking` so the page cannot disagree with checkout), landing, package detail (13 slugs
prerendered as PPR shells), portfolio, site header/footer. Admin: full CRUD for categories,
packages, add-ons and promotions, Storage cover uploads, each action `requireAdmin` + Zod +
`updateTag('catalog')`.

**Verified end to end on a production build:** edited a package through the real admin form in a
browser → both the cached landing page and the prerendered detail page showed the new value on the
next request. That is the core caching claim of this phase, so it was worth proving rather than
assuming.

Schema addition: `testimonials.author_name`. The public site needs a reviewer name, and
denormalising it is what keeps `anon` locked out of `customers` entirely (the legacy landing page
joined `clients` for this).

Design decisions made by looking at the rendered output, not by assumption:
- The first render had ~13 empty image frames stacked into a 9,500px page. With no photographs
  uploaded, placeholder frames read as broken, so package cards show a cover only when one exists,
  the detail page omits the hero frame until then, and an empty album says "Photographs coming soon"
  instead of showing fabricated plates. Page is now ~3,300px and reads as a catalogue.
- Every slot upgrades to real photography with no layout change once Storage has images.

Fixes found while verifying:
- `new Date()` in the footer broke prerendering under Cache Components (unstable value). Replaced
  with a cached, Manila-based year.
- The seed truncated `customers`, which would have deleted the owner's own linked account row,
  leaving them able to sign in but unable to book. It now deletes only rows with `profile_id is null`.
- Admin sidebar linked to five routes that do not exist yet; they render as muted labels, not 404s.

Two time sinks worth remembering:
- A lingering `next-server` child survived `kill` on its parent, so `npm start` kept failing with
  EADDRINUSE while the browser showed a **cached page from the old dev server**. Screenshots were
  therefore rendered against stale CSS, and I spent several steps "fixing" a Tailwind bug that did
  not exist. Check `ss -ltnp | grep :3000` and the served CSS filename before trusting a screenshot.
- `agent-browser click` does not reliably trigger React 19's form submit handler; `form.requestSubmit()`
  via `eval` does. The admin UI was fine — the tool was not submitting.

Deferred: mobile layout is unverified (agent-browser has no viewport control on Linux; Playwright in
Phase 8 does). `supabase db push --include-seed` is hash-gated on remote — it records a changed
seed's hash **without re-running it**, so re-seeding needs a data script or a fresh project.

### Phase 4 — Booking flow ✅ (2026-10-05)
`/book` wizard (preselect via `?package=slug`, package-scoped add-ons, date + live slot picker,
price preview), `create_booking` with 23P01 → "that slot was taken", `/account` bookings list,
`/account/bookings/[id]` with price breakdown + history timeline + cancel/undo, `/account/profile`.

Deviation from the plan: no `/api/availability` route handler. `available_slots` and `quote_booking`
are called straight from the browser Supabase client — they are RLS-safe, anon-callable by design,
and the server recomputes everything in `create_booking` anyway, so the extra endpoint only added a
layer.

Verified: 66 tests (8 new) + a full browser walkthrough — preselect, ₱600 − ₱90 = ₱510 live preview,
12 Manila-time slots, booking JR-00044 created → cancelled → restored, audit trail reading
`created → cancelled → undo_cancel`. The integration tests assert server-side pricing, `ends_at` from
package duration, booked slots leaving availability, a duplicate booking failing with 23P01, cancel
freeing the slot, **undo refused once someone else retakes it**, and off-grid start times rejected.

Lint caught two real classes of bug (worth watching for in later phases):
- `Date.now()` during render breaks component purity — same family as the footer's `new Date()`.
  Clock-dependent derivations ("is upcoming", "is cancellable") now live in `lib/bookings.ts`.
- Synchronous `setState` in an effect causes cascading renders. The wizard caches availability and
  quotes **keyed by their inputs**, so changing package/date naturally means "not loaded yet" and the
  selected slot is derived from the current list rather than reset imperatively.

Tooling note: `agent-browser`'s `click`/`fill` do not drive React 19 controlled inputs or form
submits. Use `form.requestSubmit()` and the native value setter + `input` event via `eval`.

### Phase 5 — Admin bookings + payments ✅ (2026-10-16)
Two things had to be fixed before any Phase 5 work could start:
- **The checkout was a fresh clone**: no `.env.local`, CLI not linked. Relinked with
  `supabase link --project-ref …` and rebuilt `.env.local` from
  `supabase projects api-keys --reveal` (secret keys come back masked without `--reveal`).
- **The remote had a migration the repo did not**: `20261005074337_admin_booking_rpcs`, applied
  on 2026-10-05 and never committed. It defined `set_booking_status`, `reschedule_booking` and
  `create_staff_booking` with no transition rules (expired → approved, rejected → approved were
  allowed), no slot validation (any instant: past, after hours, off-grid), an inactive add-on
  snapshotted outside the price, and `from_status` logged as null. Nothing called them. Recovered
  verbatim from `supabase_migrations.schema_migrations` into the repo (with a header saying so) so
  history matches again, then superseded.

Migrations `20261016151848_admin_bookings_and_payments` and `20261016152503_assign_staff_default`:
- **One write model.** Every write to bookings, add-on lines, events and payments goes through a
  function that owns the rules, as customer writes already did. `authenticated` keeps SELECT
  (RLS-scoped) plus DELETE on bookings (admin policy). Supabase's default grants had given it
  everything on these tables, TRUNCATE included; revoked. The unused staff write policies are dropped.
- **Status matrix** in `set_booking_status`: pending → approved (before start) / rejected /
  cancelled; approved → completed (after start) / cancelled; everything else final. Repeat submits are
  no-ops. A studio cancellation leaves `cancelled_at` null so the customer's undo cannot reverse it.
- **`staff_available_slots(date, minutes, exclude)`**: business hours, blocked dates and overlaps,
  without the customer lead time and advance window; a slot stays offered until it ends (walk-ins).
  Reschedules keep the booked length and exclude the booking being moved.
- **`create_staff_booking`**: existing customer or a new walk-in in the same transaction (a taken
  slot leaves no orphan customer; duplicate email → 23505); auto-approved; priced by `quote_booking`.
- **Ledger**: `record_payment` locks the booking row, refuses overpayment, refunds above what was
  paid, and money in on a cancelled/rejected/expired booking. `void_payment` (admin, reason required)
  replaces deletes and refuses to void a deposit while its refund stands. Voids drop out of
  `booking_payment_summary`. `payments → bookings` is now ON DELETE RESTRICT (it cascaded, so deleting
  a booking silently erased money received).
- Audit notes are customer-readable sentences ("Payment of ₱300.00 received (GCash)", "Moved from
  Oct 26, 2026 10:00 AM to Oct 28, 2026 11:00 AM: …").

App: `/admin/bookings` (server-side filters, search by reference/name/email/phone, paging, approval
queue count), `/admin/bookings/calendar` (week view with hours and blocked days),
`/admin/bookings/new` (studio booking with customer search or walk-in, live quote),
`/admin/bookings/[id]` (status, reschedule, staff, payments, voids, history, admin delete), and
`/admin/payments` (monthly ledger, totals by method). Shared vocabulary moved to
`lib/booking-status.ts` so client components can use it.

Deviations from the plan:
- No `updateNotes`. `bookings.notes` is the customer's own text and is shown back to them; staff
  notes belong in Phase 6's `customer_notes`.
- No receipt uploads yet. The private `receipts` bucket exists; nothing writes to it.
- Payments are not deletable by anyone, admin included (the plan had admin ALL). Voids replace it.

Verified: 102/102 tests (20 new integration against the dev project, 16 new unit) · tsc · lint ·
`npm run build` · advisors 0 errors (3 new intentional `authenticated_security_definer` warnings:
`assign_booking_staff`, `record_payment`, `void_payment`). No browser could run (see below), so the
UI was driven over HTTP with real `@supabase/ssr` sessions, submitting forms through React's
no-JS fallback fields (`$ACTION_REF_n`, `$ACTION_KEY`): approve with note → deposit → overpay
refused → assign → reschedule → pay in full → cancel → refund → delete refused; studio booking for
an existing customer and for a walk-in; list search (including a dotted email and an `or=()`
injection attempt); ledger totals by hand. Customers get only a streamed redirect from every admin
page, no data. Bugs found that way and fixed:
1. Keying the payment and reschedule forms to refresh them remounted them, so "Payment recorded." /
   "Booking moved." vanished on success. Only the inputs that need it are keyed now.
2. The payment form's "nothing left to record" state dropped the confirmation of the entry that
   got it there (the full refund).
3. A page number past the end read "0 bookings" (PostgREST refuses the range with no count).
4. `assign_booking_staff` had no default for the staff id, so unassigning was impossible:
   supabase-js drops the null argument and PostgREST then matches no function.
5. A cancelled, refunded booking showed "Balance ₱950.00".

Notes carried forward:
- **No browser on this machine yet** (Arch on WSL). agent-browser's Chrome lacks ~20 system
  libraries; `sudo pacman -S --needed nspr nss at-spi2-core libcups libxkbcommon alsa-lib mesa
  libx11 libxext libxcb cairo pango libxcomposite libxdamage libxfixes libxrandr` should cover them.
  Chrome is already downloaded to `~/.agent-browser`; agent-browser itself needs reinstalling.
- Not exercised over HTTP: the void action's wiring (its form only exists after a click) and the
  client-side slot/customer pickers. The RPCs behind them are covered by the integration tests.
- On `/admin/bookings/new` the posted form state is not applied in the no-JS server render (no
  `<!--F!-->` marker), unlike the detail page. It reaches the client payload, so this only matters
  for a submit before hydration.
- Overpayment is refused, so an extra charged on the day (more prints) needs a price-adjustment
  feature that does not exist yet.
- Approve/decline emails wait for Resend (Phase 6/8).

### Phase 6 — People & content — next
Customers (server-side paging/filters), notes, staff + invites, testimonial moderation + feedback
requests, contact inbox, bulk email.
