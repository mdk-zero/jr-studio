-- RECOVERED, NOT AUTHORED HERE.
--
-- This migration was applied to the hosted dev project on 2026-10-05 but never
-- committed, so the repository's history was missing a version the database
-- had. The SQL below is copied verbatim from
-- supabase_migrations.schema_migrations so local and remote agree again.
--
-- It is superseded by 20261016*_admin_bookings_and_payments.sql, which redefines
-- these functions with the full status rules, slot validation and a correct
-- audit trail. Nothing in the app ever called the versions below.

-- Staff-side booking operations.
--
-- These live in the database for the same reason create_booking does: the
-- status rules, the price and the audit event belong together in one
-- transaction. The legacy admin API set `status = payload.status ?? 'pending'`
-- with no checks, and its update path deleted every booking_services row and
-- only re-inserted when the request happened to include a service, which is
-- how bookings silently lost what they were for.

create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_note text default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can change a booking' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  if v_booking.status = p_status then
    return v_booking;
  end if;

  if p_status = 'rejected' and v_booking.status = 'approved' then
    raise exception 'An approved booking cannot be rejected. Cancel it instead.'
      using errcode = '22023';
  end if;

  if p_status = 'completed' and v_booking.starts_at > now() then
    raise exception 'This session has not happened yet, so it cannot be completed.'
      using errcode = '22023';
  end if;

  update public.bookings b
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then now() else null end,
         status_before_cancel = case
           when p_status = 'cancelled' then v_booking.status else null
         end
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, from_status, to_status, note)
  values (p_booking_id, (select auth.uid()), 'status_changed',
          v_booking.status_before_cancel, p_status, p_note);

  return v_booking;
end;
$$;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_note text default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
  v_duration integer;
  v_old timestamptz;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can reschedule a booking' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  if v_booking.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'A % booking cannot be rescheduled', v_booking.status using errcode = '22023';
  end if;

  select p.duration_minutes into v_duration
    from public.packages p where p.id = v_booking.package_id;

  v_old := v_booking.starts_at;

  if exists (
    select 1 from public.bookings b
     where b.id <> p_booking_id
       and b.status in ('pending', 'approved', 'completed')
       and b.slot && tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_duration), '[)')
  ) then
    raise exception 'Another booking already occupies that time' using errcode = '23P01';
  end if;

  update public.bookings b
     set starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => v_duration)
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, note)
  values (
    p_booking_id, (select auth.uid()), 'rescheduled',
    coalesce(p_note, 'Moved from ' || to_char(v_old at time zone 'Asia/Manila', 'DD Mon YYYY HH12:MI AM'))
  );

  return v_booking;
end;
$$;

create or replace function public.create_staff_booking(
  p_customer_id uuid,
  p_package_id uuid,
  p_starts_at timestamptz,
  p_addon_ids uuid[] default '{}',
  p_notes text default null,
  p_staff_id uuid default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_quote record;
  v_booking public.bookings;
  v_duration integer;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can create a booking here' using errcode = '42501';
  end if;

  select p.duration_minutes into v_duration
    from public.packages p where p.id = p_package_id;
  if v_duration is null then
    raise exception 'Package not found' using errcode = '22023';
  end if;

  select * into v_quote from public.quote_booking(p_package_id, p_addon_ids);

  insert into public.bookings (
    customer_id, package_id, staff_id, starts_at, ends_at, status,
    package_price, addons_total, discount_amount, total_amount, promotion_id,
    notes, source, created_by
  ) values (
    p_customer_id, p_package_id, p_staff_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration), 'approved',
    v_quote.package_price, v_quote.addons_total, v_quote.discount_amount,
    v_quote.total_amount, v_quote.promotion_id,
    nullif(trim(coalesce(p_notes, '')), ''), 'admin', (select auth.uid())
  )
  returning * into v_booking;

  insert into public.booking_addons (booking_id, addon_id, quantity, unit_price)
  select v_booking.id, a.id, 1, a.price
    from public.addons a
   where a.id = any (coalesce(p_addon_ids, '{}'::uuid[]))
     and exists (
       select 1 from public.package_addons pa
        where pa.addon_id = a.id and pa.package_id = p_package_id
     );

  insert into public.booking_events (booking_id, actor_id, type, to_status, note)
  values (v_booking.id, (select auth.uid()), 'created', 'approved',
          'Booked by the studio and auto-approved');

  return v_booking;
end;
$$;

revoke execute on function public.set_booking_status(uuid, public.booking_status, text) from public, anon;
revoke execute on function public.reschedule_booking(uuid, timestamptz, text) from public, anon;
revoke execute on function public.create_staff_booking(uuid, uuid, timestamptz, uuid[], text, uuid) from public, anon;

grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz, text) to authenticated;
grant execute on function public.create_staff_booking(uuid, uuid, timestamptz, uuid[], text, uuid) to authenticated;
