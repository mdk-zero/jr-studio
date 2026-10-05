-- Storage buckets.
--
-- Legacy stored images three incompatible ways: raw JPEG bytes in a longblob,
-- a file path hex-encoded into that same longblob column, and files on disk.
-- Every image now lives in Storage, with only its path in the database.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('packages', 'packages', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('portfolio', 'portfolio', true, 20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('staff', 'staff', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  -- Payment receipts can identify customers, so this bucket stays private and
  -- is served through short-lived signed URLs.
  ('receipts', 'receipts', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Public buckets still need an explicit SELECT policy for API-based reads.
create policy "public buckets are readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('packages', 'portfolio', 'staff'));

-- Upsert needs INSERT + SELECT + UPDATE together, so all three are granted.
create policy "staff upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('packages', 'portfolio', 'staff') and private.is_staff_or_admin());
create policy "staff update media" on storage.objects
  for update to authenticated
  using (bucket_id in ('packages', 'portfolio', 'staff') and private.is_staff_or_admin())
  with check (bucket_id in ('packages', 'portfolio', 'staff') and private.is_staff_or_admin());
create policy "staff delete media" on storage.objects
  for delete to authenticated
  using (bucket_id in ('packages', 'portfolio', 'staff') and private.is_staff_or_admin());

create policy "staff read receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and private.is_staff_or_admin());
create policy "staff write receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_staff_or_admin());
create policy "staff update receipts" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and private.is_staff_or_admin())
  with check (bucket_id = 'receipts' and private.is_staff_or_admin());
create policy "staff delete receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and private.is_admin());
