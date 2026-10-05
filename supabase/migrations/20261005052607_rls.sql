-- Row Level Security and privileges.
--
-- Two separate gates matter on Supabase:
--   1. GRANTs decide whether a table is reachable through the Data API at all.
--      Since the 2026-04-28 change, new tables are NOT exposed automatically,
--      so every table below is granted explicitly.
--   2. RLS decides which rows. Every policy names its target role AND carries a
--      predicate: `to authenticated` on its own is authentication, not
--      authorization, and would let any signed-in user read everything.
-- Policies are also split per command so UPDATE can carry both USING and
-- WITH CHECK (without WITH CHECK a row could be reassigned to someone else).

grant usage on schema public to anon, authenticated;
-- Needed so policies and RPCs can call the helpers; `private` itself is not
-- exposed as a Data API schema, so nothing in it is callable over HTTP.
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_staff_or_admin() to authenticated;
grant execute on function private.current_customer_id() to authenticated;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.staff_members enable row level security;
alter table public.categories enable row level security;
alter table public.packages enable row level security;
alter table public.package_images enable row level security;
alter table public.addons enable row level security;
alter table public.package_addons enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_packages enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_addons enable row level security;
alter table public.booking_events enable row level security;
alter table public.payments enable row level security;
alter table public.albums enable row level security;
alter table public.portfolio_photos enable row level security;
alter table public.testimonials enable row level security;
alter table public.feedback_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.email_log enable row level security;
alter table public.studio_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_dates enable row level security;

-- ---------------------------------------------------------------------------
-- Public catalog: world-readable when active, admin-writable.
-- ---------------------------------------------------------------------------
grant select on public.categories, public.packages, public.package_images,
  public.addons, public.package_addons, public.promotions,
  public.promotion_packages, public.promotions_with_status to anon, authenticated;
grant insert, update, delete on public.categories, public.packages,
  public.package_images, public.addons, public.package_addons,
  public.promotions, public.promotion_packages to authenticated;

create policy "active categories are public" on public.categories
  for select to anon, authenticated using (is_active or private.is_staff_or_admin());
create policy "admins manage categories" on public.categories
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "active packages are public" on public.packages
  for select to anon, authenticated using (is_active or private.is_staff_or_admin());
create policy "admins manage packages" on public.packages
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "package images are public" on public.package_images
  for select to anon, authenticated using (true);
create policy "admins manage package images" on public.package_images
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "active addons are public" on public.addons
  for select to anon, authenticated using (is_active or private.is_staff_or_admin());
create policy "admins manage addons" on public.addons
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "package addons are public" on public.package_addons
  for select to anon, authenticated using (true);
create policy "admins manage package addons" on public.package_addons
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Row visibility is the same for the table and its status view, because the
-- view is security_invoker.
create policy "visible promotions are public" on public.promotions
  for select to anon, authenticated
  using (
    (visible_to_customers
      and (now() at time zone 'Asia/Manila')::date between starts_on and ends_on)
    or private.is_staff_or_admin()
  );
create policy "admins manage promotions" on public.promotions
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "promotion packages are public" on public.promotion_packages
  for select to anon, authenticated using (true);
create policy "admins manage promotion packages" on public.promotion_packages
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Portfolio and testimonials
-- ---------------------------------------------------------------------------
grant select on public.albums, public.portfolio_photos to anon, authenticated;
grant insert, update, delete on public.albums, public.portfolio_photos to authenticated;

create policy "albums are public" on public.albums
  for select to anon, authenticated using (true);
create policy "staff manage albums" on public.albums
  for all to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());

create policy "portfolio is public" on public.portfolio_photos
  for select to anon, authenticated using (true);
create policy "staff manage portfolio" on public.portfolio_photos
  for all to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());

grant select on public.testimonials to anon, authenticated;
grant insert on public.testimonials to authenticated;
grant update, delete on public.testimonials to authenticated;

create policy "approved testimonials are public" on public.testimonials
  for select to anon using (status = 'approved');
create policy "customers see approved and own testimonials" on public.testimonials
  for select to authenticated
  using (
    status = 'approved'
    or customer_id = private.current_customer_id()
    or private.is_staff_or_admin()
  );
-- A customer may only review a completed booking of their own, and cannot
-- self-approve: status/is_featured must be left at their defaults.
create policy "customers review own completed bookings" on public.testimonials
  for insert to authenticated
  with check (
    customer_id = private.current_customer_id()
    and status = 'pending'
    and is_featured = false
    and exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and b.customer_id = private.current_customer_id()
         and b.status = 'completed'
    )
  );
create policy "staff moderate testimonials" on public.testimonials
  for update to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "admins delete testimonials" on public.testimonials
  for delete to authenticated using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, delete on public.customer_notes to authenticated;
grant select on public.staff_members to anon, authenticated;
grant insert, update, delete on public.staff_members to authenticated;

create policy "users read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.is_staff_or_admin());
-- Role changes are additionally blocked by private.guard_profile_role().
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

create policy "customers read own record" on public.customers
  for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff_or_admin());
create policy "customers update own record" on public.customers
  for update to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff_or_admin())
  with check (profile_id = (select auth.uid()) or private.is_staff_or_admin());
create policy "staff create customers" on public.customers
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "admins delete customers" on public.customers
  for delete to authenticated using (private.is_admin());

create policy "staff read customer notes" on public.customer_notes
  for select to authenticated using (private.is_staff_or_admin());
create policy "staff write customer notes" on public.customer_notes
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "admins delete customer notes" on public.customer_notes
  for delete to authenticated using (private.is_admin());

create policy "about page staff are public" on public.staff_members
  for select to anon using (show_on_about and status = 'active');
create policy "signed in users read staff" on public.staff_members
  for select to authenticated
  using ((show_on_about and status = 'active') or private.is_staff_or_admin());
create policy "admins manage staff" on public.staff_members
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Bookings
--
-- Customers deliberately get SELECT only. All customer writes go through
-- create_booking / cancel_booking / undo_cancel_booking, which recompute prices
-- and enforce the status rules. Staff and admins write directly.
-- ---------------------------------------------------------------------------
grant select on public.bookings, public.booking_addons, public.booking_events to authenticated;
grant insert, update, delete on public.bookings, public.booking_addons,
  public.booking_events to authenticated;

create policy "customers read own bookings" on public.bookings
  for select to authenticated
  using (customer_id = private.current_customer_id() or private.is_staff_or_admin());
create policy "staff create bookings" on public.bookings
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "staff update bookings" on public.bookings
  for update to authenticated
  using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "admins delete bookings" on public.bookings
  for delete to authenticated using (private.is_admin());

create policy "customers read own booking addons" on public.booking_addons
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and (b.customer_id = private.current_customer_id() or private.is_staff_or_admin())
    )
  );
create policy "staff manage booking addons" on public.booking_addons
  for all to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());

create policy "customers read own booking events" on public.booking_events
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and (b.customer_id = private.current_customer_id() or private.is_staff_or_admin())
    )
  );
create policy "staff write booking events" on public.booking_events
  for insert to authenticated with check (private.is_staff_or_admin());

-- Payments are read-only for customers; only staff record them.
grant select on public.payments, public.booking_payment_summary to authenticated;
grant insert, update, delete on public.payments to authenticated;

create policy "customers read own payments" on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and (b.customer_id = private.current_customer_id() or private.is_staff_or_admin())
    )
  );
create policy "staff record payments" on public.payments
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "staff update payments" on public.payments
  for update to authenticated
  using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "admins delete payments" on public.payments
  for delete to authenticated using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Inbox, email log, feedback requests
-- ---------------------------------------------------------------------------
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;

create policy "anyone can send a message" on public.contact_messages
  for insert to anon, authenticated with check (true);
create policy "staff read messages" on public.contact_messages
  for select to authenticated using (private.is_staff_or_admin());
create policy "staff update messages" on public.contact_messages
  for update to authenticated
  using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "admins delete messages" on public.contact_messages
  for delete to authenticated using (private.is_admin());

grant select on public.email_log to authenticated;
create policy "staff read email log" on public.email_log
  for select to authenticated using (private.is_staff_or_admin());

grant select on public.feedback_requests to authenticated;
create policy "staff read feedback requests" on public.feedback_requests
  for select to authenticated using (private.is_staff_or_admin());

-- ---------------------------------------------------------------------------
-- Settings: readable by everyone (the booking UI needs hours and lead times),
-- writable only by admins.
-- ---------------------------------------------------------------------------
grant select on public.studio_settings, public.business_hours, public.blocked_dates
  to anon, authenticated;
grant insert, update, delete on public.studio_settings, public.business_hours,
  public.blocked_dates to authenticated;

create policy "settings are public" on public.studio_settings
  for select to anon, authenticated using (true);
create policy "admins update settings" on public.studio_settings
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "business hours are public" on public.business_hours
  for select to anon, authenticated using (true);
create policy "admins manage business hours" on public.business_hours
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "blocked dates are public" on public.blocked_dates
  for select to anon, authenticated using (true);
create policy "admins manage blocked dates" on public.blocked_dates
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- RPC privileges
-- ---------------------------------------------------------------------------
grant execute on function public.quote_booking(uuid, uuid[]) to anon, authenticated;
grant execute on function public.available_slots(uuid, date) to anon, authenticated;
-- Booking writes require a session; anon is deliberately excluded.
grant execute on function public.create_booking(uuid, timestamptz, uuid[], text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.undo_cancel_booking(uuid) to authenticated;
revoke execute on function private.expire_pending_bookings() from anon, authenticated;
