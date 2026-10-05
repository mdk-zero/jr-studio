-- Advisor follow-ups from the initial schema push.
--
-- 1. Postgres grants EXECUTE to PUBLIC on every new function, and `anon`
--    inherits from PUBLIC. So the booking RPCs were callable without signing
--    in, despite only being granted to `authenticated`. They would have failed
--    on their internal auth check, but the reachable surface is removed here.
-- 2. A "public read" policy plus a FOR ALL admin policy both applied to SELECT,
--    so two policies were evaluated per row. The admin policies are narrowed to
--    the write commands; admins keep read access through the public policy,
--    which already allows staff/admin (or is unconditional).

-- --------------------------------------------------------------------------
-- 1. Function privileges
-- --------------------------------------------------------------------------
revoke execute on function public.create_booking(uuid, timestamptz, uuid[], text) from public;
revoke execute on function public.cancel_booking(uuid) from public;
revoke execute on function public.undo_cancel_booking(uuid) from public;
revoke execute on function public.quote_booking(uuid, uuid[]) from public;
revoke execute on function public.available_slots(uuid, date) from public;

grant execute on function public.create_booking(uuid, timestamptz, uuid[], text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.undo_cancel_booking(uuid) to authenticated;
-- Intentionally public: visitors must see prices and open slots before signing
-- up. Both return catalog/availability data only, never personal data.
grant execute on function public.quote_booking(uuid, uuid[]) to anon, authenticated;
grant execute on function public.available_slots(uuid, date) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 2. Narrow the admin/staff FOR ALL policies to writes only
-- --------------------------------------------------------------------------

drop policy "admins manage categories" on public.categories;
create policy "admins manage categories (insert)" on public.categories
  for insert to authenticated with check (private.is_admin());
create policy "admins manage categories (update)" on public.categories
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage categories (delete)" on public.categories
  for delete to authenticated using (private.is_admin());

drop policy "admins manage packages" on public.packages;
create policy "admins manage packages (insert)" on public.packages
  for insert to authenticated with check (private.is_admin());
create policy "admins manage packages (update)" on public.packages
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage packages (delete)" on public.packages
  for delete to authenticated using (private.is_admin());

drop policy "admins manage package images" on public.package_images;
create policy "admins manage package images (insert)" on public.package_images
  for insert to authenticated with check (private.is_admin());
create policy "admins manage package images (update)" on public.package_images
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage package images (delete)" on public.package_images
  for delete to authenticated using (private.is_admin());

drop policy "admins manage addons" on public.addons;
create policy "admins manage addons (insert)" on public.addons
  for insert to authenticated with check (private.is_admin());
create policy "admins manage addons (update)" on public.addons
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage addons (delete)" on public.addons
  for delete to authenticated using (private.is_admin());

drop policy "admins manage package addons" on public.package_addons;
create policy "admins manage package addons (insert)" on public.package_addons
  for insert to authenticated with check (private.is_admin());
create policy "admins manage package addons (update)" on public.package_addons
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage package addons (delete)" on public.package_addons
  for delete to authenticated using (private.is_admin());

drop policy "admins manage promotions" on public.promotions;
create policy "admins manage promotions (insert)" on public.promotions
  for insert to authenticated with check (private.is_admin());
create policy "admins manage promotions (update)" on public.promotions
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage promotions (delete)" on public.promotions
  for delete to authenticated using (private.is_admin());

drop policy "admins manage promotion packages" on public.promotion_packages;
create policy "admins manage promotion packages (insert)" on public.promotion_packages
  for insert to authenticated with check (private.is_admin());
create policy "admins manage promotion packages (update)" on public.promotion_packages
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage promotion packages (delete)" on public.promotion_packages
  for delete to authenticated using (private.is_admin());

drop policy "staff manage albums" on public.albums;
create policy "staff manage albums (insert)" on public.albums
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "staff manage albums (update)" on public.albums
  for update to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "staff manage albums (delete)" on public.albums
  for delete to authenticated using (private.is_staff_or_admin());

drop policy "staff manage portfolio" on public.portfolio_photos;
create policy "staff manage portfolio (insert)" on public.portfolio_photos
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "staff manage portfolio (update)" on public.portfolio_photos
  for update to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "staff manage portfolio (delete)" on public.portfolio_photos
  for delete to authenticated using (private.is_staff_or_admin());

drop policy "admins manage staff" on public.staff_members;
create policy "admins manage staff (insert)" on public.staff_members
  for insert to authenticated with check (private.is_admin());
create policy "admins manage staff (update)" on public.staff_members
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage staff (delete)" on public.staff_members
  for delete to authenticated using (private.is_admin());

drop policy "staff manage booking addons" on public.booking_addons;
create policy "staff manage booking addons (insert)" on public.booking_addons
  for insert to authenticated with check (private.is_staff_or_admin());
create policy "staff manage booking addons (update)" on public.booking_addons
  for update to authenticated using (private.is_staff_or_admin()) with check (private.is_staff_or_admin());
create policy "staff manage booking addons (delete)" on public.booking_addons
  for delete to authenticated using (private.is_staff_or_admin());

drop policy "admins manage business hours" on public.business_hours;
create policy "admins manage business hours (insert)" on public.business_hours
  for insert to authenticated with check (private.is_admin());
create policy "admins manage business hours (update)" on public.business_hours
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage business hours (delete)" on public.business_hours
  for delete to authenticated using (private.is_admin());

drop policy "admins manage blocked dates" on public.blocked_dates;
create policy "admins manage blocked dates (insert)" on public.blocked_dates
  for insert to authenticated with check (private.is_admin());
create policy "admins manage blocked dates (update)" on public.blocked_dates
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage blocked dates (delete)" on public.blocked_dates
  for delete to authenticated using (private.is_admin());
