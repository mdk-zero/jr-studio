-- Helper functions, triggers and the RPCs that own the booking rules.
--
-- Everything SECURITY DEFINER either lives in `private` (unreachable via the
-- Data API) or, where it must be callable by the app, carries its own explicit
-- authorization check. All of them pin search_path to '' and fully qualify
-- names, so a caller cannot shadow an object to hijack the function.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.staff_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.packages
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.addons
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.promotions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.albums
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.studio_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers
--
-- SECURITY DEFINER is required here: these read public.profiles from inside
-- policies ON public.profiles, which would otherwise recurse. They are in
-- `private`, so they are not exposed as RPC endpoints.
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function private.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'staff')
  );
$$;

/** The customers row belonging to the signed-in user, if any. */
create or replace function private.current_customer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.customers c where c.profile_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Privilege escalation guard
--
-- RLS alone cannot express "you may update your row but not your own role",
-- because WITH CHECK cannot see the old value.
-- ---------------------------------------------------------------------------
create or replace function private.guard_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for trusted server contexts (secret key, cron, SQL
    -- editor); an end user must be an admin.
    if (select auth.uid()) is not null and not private.is_admin() then
      raise exception 'Only an admin can change a role';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_role before update on public.profiles
  for each row execute function private.guard_profile_role();

-- ---------------------------------------------------------------------------
-- New auth users
--
-- Split in two deliberately. The profile is created on signup, but a walk-in
-- customer is only claimed once the email is CONFIRMED — otherwise signing up
-- with someone else's address would inherit their booking history.
-- Role is always 'customer' here; it is never read from user metadata, which
-- the user controls.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_claimed uuid;
begin
  -- Claim an unclaimed walk-in created by an admin with the same email.
  update public.customers c
     set profile_id = new.id,
         updated_at = now()
   where c.profile_id is null
     and lower(c.email) = lower(new.email)
   returning c.id into v_claimed;

  if v_claimed is null and not exists (
    select 1 from public.customers c where c.profile_id = new.id
  ) then
    insert into public.customers (profile_id, full_name, email, phone)
    select p.id, p.full_name, p.email, p.phone
      from public.profiles p where p.id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_confirmed after update on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.handle_email_confirmed();

-- ---------------------------------------------------------------------------
-- Booking reference
-- ---------------------------------------------------------------------------
create or replace function private.set_booking_reference()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reference is null then
    new.reference := 'JR-' || lpad(nextval('public.booking_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger set_booking_reference before insert on public.bookings
  for each row execute function private.set_booking_reference();

-- ---------------------------------------------------------------------------
-- Pricing: THE formula
--
-- Legacy had four disagreeing implementations (two in the services API, one in
-- the browser, one in the booking API). Every caller uses this one instead.
-- Rule: subtotal = package price + linked add-ons, then the single highest
-- promotion that is active today in Manila and attached to that package.
-- ---------------------------------------------------------------------------
create or replace function public.quote_booking(
  p_package_id uuid,
  p_addon_ids uuid[] default '{}'
)
returns table (
  package_price numeric,
  addons_total numeric,
  promotion_id uuid,
  discount_percent integer,
  discount_amount numeric,
  total_amount numeric
)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_price numeric(10, 2);
  v_addons numeric(10, 2);
  v_promo_id uuid;
  v_promo_pct integer;
  v_subtotal numeric(10, 2);
  v_discount numeric(10, 2);
begin
  select p.price into v_price
    from public.packages p
   where p.id = p_package_id and p.is_active;

  if v_price is null then
    raise exception 'Package % is not available', p_package_id using errcode = '22023';
  end if;

  -- Only add-ons actually offered with this package count, so a crafted
  -- request cannot attach (and pay for) an unrelated add-on.
  select coalesce(sum(a.price), 0) into v_addons
    from public.addons a
   where a.id = any (coalesce(p_addon_ids, '{}'::uuid[]))
     and a.is_active
     and exists (
       select 1 from public.package_addons pa
        where pa.addon_id = a.id and pa.package_id = p_package_id
     );

  v_subtotal := v_price + v_addons;

  select pr.id, pr.discount_percent into v_promo_id, v_promo_pct
    from public.promotions pr
    join public.promotion_packages pp on pp.promotion_id = pr.id
   where pp.package_id = p_package_id
     and (now() at time zone 'Asia/Manila')::date between pr.starts_on and pr.ends_on
   order by pr.discount_percent desc, pr.id
   limit 1;

  v_discount := case
    when v_promo_id is null then 0
    else round(v_subtotal * v_promo_pct / 100.0, 2)
  end;

  return query select v_price, v_addons, v_promo_id, v_promo_pct, v_discount, v_subtotal - v_discount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Availability
--
-- SECURITY DEFINER on purpose: a customer cannot read other people's bookings
-- (RLS), but must still see which slots are taken. Only time ranges are
-- returned, never booking details.
-- ---------------------------------------------------------------------------
create or replace function public.available_slots(p_package_id uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_duration integer;
  v_interval integer;
  v_lead integer;
  v_max integer;
  v_opens time;
  v_closes time;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cursor timestamptz;
  v_slot_end timestamptz;
  v_day_end timestamptz;
begin
  select p.duration_minutes into v_duration
    from public.packages p where p.id = p_package_id and p.is_active;
  if v_duration is null then return; end if;

  select s.slot_interval_minutes, s.min_lead_hours, s.max_advance_days
    into v_interval, v_lead, v_max
    from public.studio_settings s where s.id;

  -- Inside the bookable window, and not a holiday the studio blocked out.
  if p_date < v_today or p_date > v_today + v_max then return; end if;
  if exists (select 1 from public.blocked_dates b where b.blocked_on = p_date) then return; end if;

  select h.opens_at, h.closes_at into v_opens, v_closes
    from public.business_hours h
   where h.weekday = extract(dow from p_date)::smallint and h.is_open;
  if v_opens is null then return; end if;

  -- Interpret the studio's wall-clock hours in Manila, so slots land on the
  -- hour locally regardless of where the server runs.
  v_cursor := (p_date + v_opens) at time zone 'Asia/Manila';
  v_day_end := (p_date + v_closes) at time zone 'Asia/Manila';

  loop
    v_slot_end := v_cursor + make_interval(mins => v_duration);
    -- The whole session has to finish before closing time.
    exit when v_slot_end > v_day_end;

    if v_cursor >= now() + make_interval(hours => v_lead)
       and not exists (
         select 1 from public.bookings b
          where b.status in ('pending', 'approved', 'completed')
            and b.slot && tstzrange(v_cursor, v_slot_end, '[)')
       )
    then
      starts_at := v_cursor;
      ends_at := v_slot_end;
      return next;
    end if;

    v_cursor := v_cursor + make_interval(mins => v_interval);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking writes
--
-- Customers never get INSERT/UPDATE on bookings; they go through these
-- functions. That is what stops a crafted PostgREST call from inserting a
-- booking with total_amount = 0 (the legacy endpoint trusted posted values).
-- Prices are always recomputed here from quote_booking.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_package_id uuid,
  p_starts_at timestamptz,
  p_addon_ids uuid[] default '{}',
  p_notes text default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid := private.current_customer_id();
  v_quote record;
  v_booking public.bookings;
  v_duration integer;
begin
  if v_customer is null then
    raise exception 'No customer record for the signed-in user' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.customers c
     where c.id = v_customer and c.status <> 'active'
  ) then
    raise exception 'This account cannot make bookings' using errcode = '42501';
  end if;

  -- The requested time must be a slot the availability rules actually offer
  -- (business hours, lead time, blocked dates, closing time, no overlap).
  if not exists (
    select 1
      from public.available_slots(p_package_id, (p_starts_at at time zone 'Asia/Manila')::date) s
     where s.starts_at = p_starts_at
  ) then
    raise exception 'That time slot is not available' using errcode = '23P01';
  end if;

  select p.duration_minutes into v_duration
    from public.packages p where p.id = p_package_id;

  select * into v_quote from public.quote_booking(p_package_id, p_addon_ids);

  insert into public.bookings (
    customer_id, package_id, starts_at, ends_at, status,
    package_price, addons_total, discount_amount, total_amount, promotion_id,
    notes, source, created_by
  ) values (
    v_customer, p_package_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration), 'pending',
    v_quote.package_price, v_quote.addons_total, v_quote.discount_amount,
    v_quote.total_amount, v_quote.promotion_id,
    nullif(trim(coalesce(p_notes, '')), ''), 'customer', (select auth.uid())
  )
  returning * into v_booking;

  -- Snapshot add-on prices, restricted to add-ons valid for this package.
  insert into public.booking_addons (booking_id, addon_id, quantity, unit_price)
  select v_booking.id, a.id, 1, a.price
    from public.addons a
   where a.id = any (coalesce(p_addon_ids, '{}'::uuid[]))
     and a.is_active
     and exists (
       select 1 from public.package_addons pa
        where pa.addon_id = a.id and pa.package_id = p_package_id
     );

  insert into public.booking_events (booking_id, actor_id, type, to_status, note)
  values (v_booking.id, (select auth.uid()), 'created', 'pending', 'Booking requested by customer');

  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid := private.current_customer_id();
  v_booking public.bookings;
  v_cutoff integer;
begin
  select s.cancel_cutoff_hours into v_cutoff from public.studio_settings s where s.id;

  select * into v_booking from public.bookings b
   where b.id = p_booking_id and b.customer_id = v_customer;

  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '42501';
  end if;

  if v_booking.status not in ('pending', 'approved') then
    raise exception 'A % booking cannot be cancelled', v_booking.status using errcode = '22023';
  end if;

  if v_booking.starts_at <= now() + make_interval(hours => v_cutoff) then
    raise exception 'Bookings must be cancelled at least % hours ahead', v_cutoff using errcode = '22023';
  end if;

  update public.bookings b
     set status = 'cancelled',
         status_before_cancel = v_booking.status,
         cancelled_at = now()
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, from_status, to_status, note)
  values (p_booking_id, (select auth.uid()), 'cancelled',
          v_booking.status_before_cancel, 'cancelled', 'Cancelled by customer');

  return v_booking;
end;
$$;

/**
 * Undo a cancellation inside the configured window. State lives in the row, so
 * unlike the legacy session-based undo it survives logout and other devices.
 * If someone else took the freed slot meanwhile, the exclusion constraint
 * rejects this update with 23P01.
 */
create or replace function public.undo_cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid := private.current_customer_id();
  v_booking public.bookings;
  v_window integer;
begin
  select s.undo_window_seconds into v_window from public.studio_settings s where s.id;

  select * into v_booking from public.bookings b
   where b.id = p_booking_id and b.customer_id = v_customer;

  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '42501';
  end if;

  if v_booking.status <> 'cancelled' or v_booking.cancelled_at is null then
    raise exception 'This booking is not cancelled' using errcode = '22023';
  end if;

  if now() > v_booking.cancelled_at + make_interval(secs => v_window) then
    raise exception 'The undo window has passed' using errcode = '22023';
  end if;

  update public.bookings b
     set status = coalesce(v_booking.status_before_cancel, 'pending'),
         status_before_cancel = null,
         cancelled_at = null
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, from_status, to_status, note)
  values (p_booking_id, (select auth.uid()), 'undo_cancel', 'cancelled', v_booking.status,
          'Cancellation undone by customer');

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled expiry
--
-- Legacy ran this UPDATE on every admin page load, so bookings expired only if
-- someone happened to be looking. Driven by pg_cron instead.
-- ---------------------------------------------------------------------------
create or replace function private.expire_pending_bookings()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with expired as (
    update public.bookings b
       set status = 'expired'
     where b.status = 'pending' and b.starts_at < now()
    returning b.id
  )
  insert into public.booking_events (booking_id, type, from_status, to_status, note)
  select e.id, 'expired', 'pending', 'expired', 'Start time passed while still pending'
    from expired e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
