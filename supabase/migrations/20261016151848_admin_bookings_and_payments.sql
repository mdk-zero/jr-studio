-- Phase 5: staff-side booking operations and the payment ledger.
--
-- Supersedes the three functions in 20261005074337 (recovered from the remote
-- history). Those let staff move a booking between almost any two statuses
-- (expired -> approved, rejected -> approved, completed -> pending), book any
-- instant at all (in the past, after hours, off the slot grid), snapshot an
-- inactive add-on that the price had left out, and logged every status change
-- with an empty from_status.
--
-- The model after this migration: every write to bookings, their add-on lines,
-- their audit events and payments goes through a function that owns the rules,
-- the same way customer writes already did. Signed-in users keep SELECT (scoped
-- by RLS) and admins keep DELETE on bookings. The direct INSERT/UPDATE paths
-- are removed, so a crafted PostgREST call cannot set its own total, skip a
-- status rule, forge a history entry or rewrite the ledger.

-- ---------------------------------------------------------------------------
-- Formatting for audit notes and error messages. Customers read these notes in
-- their booking history, so they are written as sentences, not codes.
-- ---------------------------------------------------------------------------
create or replace function private.format_peso(p_amount numeric)
returns text language sql stable set search_path = '' as $$
  -- Period and comma are literal in to_char, unlike D and G, so the output does
  -- not depend on the server locale.
  select '₱' || to_char(abs(p_amount), 'FM999,999,990.00');
$$;

create or replace function private.format_manila(p_at timestamptz)
returns text language sql stable set search_path = '' as $$
  select to_char(p_at at time zone 'Asia/Manila', 'Mon FMDD, YYYY FMHH12:MI AM');
$$;

create or replace function private.payment_method_label(p_method public.payment_method)
returns text language sql immutable set search_path = '' as $$
  select case p_method
    when 'cash' then 'cash'
    when 'gcash' then 'GCash'
    when 'bank_transfer' then 'bank transfer'
    when 'card' then 'card'
    else 'other method'
  end;
$$;

revoke execute on function private.format_peso(numeric) from public;
revoke execute on function private.format_manila(timestamptz) from public;
revoke execute on function private.payment_method_label(public.payment_method) from public;

-- ---------------------------------------------------------------------------
-- Payments: void instead of delete
--
-- A ledger entry recorded by mistake is voided with a reason, never removed, so
-- the history of what was entered (and by whom) survives. Voided rows stop
-- counting towards the balance.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column voided_at timestamptz,
  add column voided_by uuid references public.profiles (id) on delete set null,
  add column void_reason text,
  add constraint payments_void_has_reason
    check (voided_at is null or length(trim(coalesce(void_reason, ''))) > 0);

-- Deleting a booking used to cascade into its payments, silently erasing money
-- that was actually received. Now a booking with payments on record cannot be
-- deleted at all; it is cancelled (and refunded) instead.
alter table public.payments drop constraint payments_booking_id_fkey;
alter table public.payments
  add constraint payments_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete restrict;

create or replace view public.booking_payment_summary
with (security_invoker = true) as
select
  b.id as booking_id,
  b.total_amount,
  coalesce(sum(p.amount), 0) as paid_total,
  b.total_amount - coalesce(sum(p.amount), 0) as balance,
  case
    when count(p.id) > 0 and coalesce(sum(p.amount), 0) <= 0 then 'refunded'
    when coalesce(sum(p.amount), 0) <= 0 then 'unpaid'
    when coalesce(sum(p.amount), 0) >= b.total_amount then 'paid'
    else 'partial'
  end as payment_status
from public.bookings b
left join public.payments p on p.booking_id = b.id and p.voided_at is null
group by b.id, b.total_amount;

-- ---------------------------------------------------------------------------
-- Studio-side availability
--
-- Same grid as available_slots (business hours, blocked dates, the session must
-- finish by closing time, no overlap), minus the two rules that exist to protect
-- the studio from customers: the minimum lead time and the maximum advance
-- window. A walk-in can be booked into the session that is running now, so a
-- slot is offered until it ends rather than until it starts.
--
-- Takes a duration rather than a package so a reschedule keeps the length that
-- was booked, and can exclude the booking being moved so it does not block
-- itself.
-- ---------------------------------------------------------------------------
create or replace function public.staff_available_slots(
  p_date date,
  p_duration_minutes integer,
  p_exclude_booking_id uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_interval integer;
  v_opens time;
  v_closes time;
  v_cursor timestamptz;
  v_slot_end timestamptz;
  v_day_end timestamptz;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can see the studio calendar' using errcode = '42501';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then return; end if;
  if p_date < (now() at time zone 'Asia/Manila')::date then return; end if;
  if exists (select 1 from public.blocked_dates b where b.blocked_on = p_date) then return; end if;

  select h.opens_at, h.closes_at into v_opens, v_closes
    from public.business_hours h
   where h.weekday = extract(dow from p_date)::smallint and h.is_open;
  if v_opens is null then return; end if;

  select s.slot_interval_minutes into v_interval from public.studio_settings s where s.id;

  v_cursor := (p_date + v_opens) at time zone 'Asia/Manila';
  v_day_end := (p_date + v_closes) at time zone 'Asia/Manila';

  loop
    v_slot_end := v_cursor + make_interval(mins => p_duration_minutes);
    exit when v_slot_end > v_day_end;

    if v_slot_end > now()
       and not exists (
         select 1 from public.bookings b
          where b.status in ('pending', 'approved', 'completed')
            and b.id is distinct from p_exclude_booking_id
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
-- Status changes
--
--   pending  -> approved   (only before the session starts)
--   pending  -> rejected
--   pending  -> cancelled
--   approved -> cancelled  (an approved booking is cancelled, never rejected)
--   approved -> completed  (only once the session has started)
--
-- pending -> expired belongs to the cron job, and cancelled -> back belongs to
-- the customer's undo. Everything else is final.
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_note text default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
  v_from public.booking_status;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_summary text;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can change a booking' using errcode = '42501';
  end if;

  -- Row lock: two people pressing Approve and Reject at once cannot both win.
  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  v_from := v_booking.status;
  -- A repeated submit (double click, second tab) is not an error.
  if v_from = p_status then
    return v_booking;
  end if;

  case p_status
    when 'approved' then
      if v_from <> 'pending' then
        raise exception 'Only a pending booking can be approved' using errcode = '22023';
      end if;
      if v_booking.starts_at <= now() then
        raise exception 'This session has already started, so it can no longer be approved'
          using errcode = '22023';
      end if;
      v_summary := 'Approved by the studio';
    when 'rejected' then
      if v_from = 'approved' then
        raise exception 'An approved booking cannot be rejected. Cancel it instead.'
          using errcode = '22023';
      end if;
      if v_from <> 'pending' then
        raise exception 'Only a pending booking can be rejected' using errcode = '22023';
      end if;
      v_summary := 'Declined by the studio';
    when 'cancelled' then
      if v_from not in ('pending', 'approved') then
        raise exception 'A % booking cannot be cancelled', v_from using errcode = '22023';
      end if;
      v_summary := 'Cancelled by the studio';
    when 'completed' then
      if v_from <> 'approved' then
        raise exception 'Only an approved booking can be marked completed' using errcode = '22023';
      end if;
      if v_booking.starts_at > now() then
        raise exception 'This session has not happened yet, so it cannot be completed.'
          using errcode = '22023';
      end if;
      v_summary := 'Marked as completed';
    else
      raise exception 'A booking cannot be set to % by hand', p_status using errcode = '22023';
  end case;

  -- cancelled_at is what opens the customer's undo window (undo_cancel_booking
  -- requires it), so a studio cancellation leaves it null: a customer must not
  -- be able to reverse the studio's decision. When it happened is in the event.
  update public.bookings b
     set status = p_status
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, from_status, to_status, note)
  values (p_booking_id, (select auth.uid()), 'status_changed', v_from, p_status,
          v_summary || coalesce(': ' || v_note, ''));

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reschedule
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_note text default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
  v_minutes integer;
  v_old timestamptz;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can reschedule a booking' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  if v_booking.status not in ('pending', 'approved') then
    raise exception 'Only a pending or approved booking can be rescheduled' using errcode = '22023';
  end if;

  if p_starts_at = v_booking.starts_at then
    return v_booking;
  end if;

  -- Keep the length that was booked, even if the package has changed since.
  v_minutes := (extract(epoch from (v_booking.ends_at - v_booking.starts_at)) / 60)::integer;
  v_old := v_booking.starts_at;

  if not exists (
    select 1
      from public.staff_available_slots(
        (p_starts_at at time zone 'Asia/Manila')::date, v_minutes, p_booking_id
      ) s
     where s.starts_at = p_starts_at
  ) then
    raise exception 'That time is not available' using errcode = '23P01';
  end if;

  update public.bookings b
     set starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => v_minutes)
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, note)
  values (
    p_booking_id, (select auth.uid()), 'rescheduled',
    'Moved from ' || private.format_manila(v_old) || ' to ' || private.format_manila(p_starts_at)
      || coalesce(': ' || v_note, '')
  );

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Studio-made bookings (walk-ins, phone bookings)
--
-- Auto-approved, as in the legacy system. Either books an existing customer or
-- creates a walk-in in the same transaction, so a slot that turns out to be
-- taken does not leave an orphan customer behind. Price comes from
-- quote_booking, exactly as for customers.
-- ---------------------------------------------------------------------------
drop function public.create_staff_booking(uuid, uuid, timestamptz, uuid[], text, uuid);

create function public.create_staff_booking(
  p_package_id uuid,
  p_starts_at timestamptz,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_addon_ids uuid[] default '{}',
  p_staff_id uuid default null,
  p_notes text default null
)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid := p_customer_id;
  v_duration integer;
  v_quote record;
  v_booking public.bookings;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can create a booking here' using errcode = '42501';
  end if;

  select p.duration_minutes into v_duration
    from public.packages p where p.id = p_package_id and p.is_active;
  if v_duration is null then
    raise exception 'That package is not available' using errcode = '22023';
  end if;

  if p_staff_id is not null and not exists (
    select 1 from public.staff_members s where s.id = p_staff_id and s.status = 'active'
  ) then
    raise exception 'That staff member is not active' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.staff_available_slots((p_starts_at at time zone 'Asia/Manila')::date, v_duration) s
     where s.starts_at = p_starts_at
  ) then
    raise exception 'That time is not available' using errcode = '23P01';
  end if;

  if v_customer is not null then
    if not exists (
      select 1 from public.customers c where c.id = v_customer and c.status = 'active'
    ) then
      raise exception 'That customer is inactive or no longer exists' using errcode = '22023';
    end if;
  else
    if length(trim(coalesce(p_customer_name, ''))) < 2 then
      raise exception 'Enter the customer''s name' using errcode = '22023';
    end if;
    -- A duplicate email raises 23505 from customers_email_lower_key, which the
    -- app turns into "pick the existing customer instead".
    insert into public.customers (full_name, email, phone)
    values (
      trim(p_customer_name),
      nullif(lower(trim(coalesce(p_customer_email, ''))), ''),
      nullif(trim(coalesce(p_customer_phone, '')), '')
    )
    returning id into v_customer;
  end if;

  select * into v_quote from public.quote_booking(p_package_id, p_addon_ids);

  insert into public.bookings (
    customer_id, package_id, staff_id, starts_at, ends_at, status,
    package_price, addons_total, discount_amount, total_amount, promotion_id,
    notes, source, created_by
  ) values (
    v_customer, p_package_id, p_staff_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration), 'approved',
    v_quote.package_price, v_quote.addons_total, v_quote.discount_amount,
    v_quote.total_amount, v_quote.promotion_id,
    nullif(trim(coalesce(p_notes, '')), ''), 'admin', (select auth.uid())
  )
  returning * into v_booking;

  -- The same add-on filter quote_booking applies, so the lines always add up
  -- to addons_total.
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
  values (v_booking.id, (select auth.uid()), 'created', 'approved', 'Booked by the studio');

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff assignment. The bookings_staff_no_overlap constraint still guards
-- double-booking a person.
-- ---------------------------------------------------------------------------
create or replace function public.assign_booking_staff(p_booking_id uuid, p_staff_id uuid)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
  v_name text;
  v_previous text;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can assign a booking' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  if v_booking.status not in ('pending', 'approved', 'completed') then
    raise exception 'A % booking cannot be assigned', v_booking.status using errcode = '22023';
  end if;

  if v_booking.staff_id is not distinct from p_staff_id then
    return v_booking;
  end if;

  if p_staff_id is not null then
    select s.full_name into v_name
      from public.staff_members s where s.id = p_staff_id and s.status = 'active';
    if v_name is null then
      raise exception 'That staff member is not active' using errcode = '22023';
    end if;
  end if;

  select s.full_name into v_previous from public.staff_members s where s.id = v_booking.staff_id;

  update public.bookings b
     set staff_id = p_staff_id
   where b.id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, actor_id, type, note)
  values (
    p_booking_id, (select auth.uid()), 'staff_assigned',
    case when p_staff_id is null then 'Unassigned ' || coalesce(v_previous, 'staff')
         else 'Assigned to ' || v_name end
  );

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ledger writes
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_reference_no text default null,
  p_paid_at timestamptz default null,
  p_note text default null
)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
  v_amount numeric(10, 2) := round(p_amount, 2);
  v_paid numeric(10, 2);
  v_payment public.payments;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can record payments' using errcode = '42501';
  end if;

  -- Locking the booking serialises every ledger write against it, so two
  -- people recording the same balance at once cannot both pass the check below.
  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  if v_amount is null or v_amount = 0 then
    raise exception 'Enter an amount' using errcode = '22023';
  end if;

  if p_paid_at is not null and p_paid_at > now() + interval '5 minutes' then
    raise exception 'The payment date cannot be in the future' using errcode = '22023';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
   where p.booking_id = p_booking_id and p.voided_at is null;

  if v_amount > 0 then
    if v_booking.status not in ('pending', 'approved', 'completed') then
      raise exception 'A % booking cannot take a payment. Record a refund instead.', v_booking.status
        using errcode = '22023';
    end if;
    if v_amount > v_booking.total_amount - v_paid then
      raise exception 'That is more than the % still owed',
        private.format_peso(greatest(v_booking.total_amount - v_paid, 0))
        using errcode = '22023';
    end if;
  elsif -v_amount > v_paid then
    raise exception 'A refund cannot be more than the % paid so far', private.format_peso(v_paid)
      using errcode = '22023';
  end if;

  insert into public.payments (booking_id, amount, method, reference_no, paid_at, recorded_by, note)
  values (
    p_booking_id, v_amount, p_method,
    nullif(trim(coalesce(p_reference_no, '')), ''),
    coalesce(p_paid_at, now()),
    (select auth.uid()),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_payment;

  insert into public.booking_events (booking_id, actor_id, type, note)
  values (
    p_booking_id, (select auth.uid()),
    case when v_amount > 0 then 'payment_recorded' else 'refund_recorded' end,
    case when v_amount > 0 then 'Payment of ' else 'Refund of ' end
      || private.format_peso(v_amount)
      || case when v_amount > 0 then ' received (' else ' issued (' end
      || private.payment_method_label(p_method) || ')'
  );

  return v_payment;
end;
$$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v_booking_id uuid;
  v_payment public.payments;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_remaining numeric(10, 2);
begin
  if not private.is_admin() then
    raise exception 'Only an admin can void a payment' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Give a reason for voiding this payment' using errcode = '22023';
  end if;

  select p.booking_id into v_booking_id from public.payments p where p.id = p_payment_id;
  if v_booking_id is null then
    raise exception 'Payment not found' using errcode = '22023';
  end if;

  -- Same lock as record_payment, taken first, so a void and a new payment on
  -- one booking cannot interleave.
  perform 1 from public.bookings b where b.id = v_booking_id for update;
  select * into v_payment from public.payments p where p.id = p_payment_id for update;

  if v_payment.voided_at is not null then
    raise exception 'This payment has already been voided' using errcode = '22023';
  end if;

  -- Voiding a deposit while its refund still stands would leave the ledger
  -- showing money returned that was never received.
  select coalesce(sum(p.amount), 0) into v_remaining
    from public.payments p
   where p.booking_id = v_booking_id and p.voided_at is null and p.id <> p_payment_id;
  if v_remaining < 0 then
    raise exception 'Void the refund first: without this payment the booking would show more refunded than paid'
      using errcode = '22023';
  end if;

  update public.payments p
     set voided_at = now(),
         voided_by = (select auth.uid()),
         void_reason = v_reason
   where p.id = p_payment_id
  returning * into v_payment;

  insert into public.booking_events (booking_id, actor_id, type, note)
  values (
    v_booking_id, (select auth.uid()), 'payment_voided',
    case when v_payment.amount > 0 then 'Payment of ' else 'Refund of ' end
      || private.format_peso(v_payment.amount) || ' voided: ' || v_reason
  );

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
--
-- Supabase's default privileges had given `authenticated` everything on these
-- tables, TRUNCATE included. From here, reads are scoped by RLS and writes go
-- through the functions above.
-- ---------------------------------------------------------------------------
revoke all on
  public.bookings,
  public.booking_addons,
  public.booking_events,
  public.payments,
  public.booking_payment_summary
from authenticated;

grant select on
  public.bookings,
  public.booking_addons,
  public.booking_events,
  public.payments,
  public.booking_payment_summary
to authenticated;

-- A booking made in error can still be deleted by an admin ("admins delete
-- bookings"). Its add-on lines and history go with it; its payments block it.
grant delete on public.bookings to authenticated;

drop policy "staff create bookings" on public.bookings;
drop policy "staff update bookings" on public.bookings;
drop policy "staff manage booking addons (insert)" on public.booking_addons;
drop policy "staff manage booking addons (update)" on public.booking_addons;
drop policy "staff manage booking addons (delete)" on public.booking_addons;
drop policy "staff write booking events" on public.booking_events;
drop policy "staff record payments" on public.payments;
drop policy "staff update payments" on public.payments;
drop policy "admins delete payments" on public.payments;

-- Supabase grants EXECUTE on new public functions to anon directly, so revoking
-- from PUBLIC alone is not enough (see 20261005053448).
revoke execute on function public.staff_available_slots(date, integer, uuid) from public, anon;
revoke execute on function public.create_staff_booking(uuid, timestamptz, uuid, text, text, text, uuid[], uuid, text) from public, anon;
revoke execute on function public.assign_booking_staff(uuid, uuid) from public, anon;
revoke execute on function public.record_payment(uuid, numeric, public.payment_method, text, timestamptz, text) from public, anon;
revoke execute on function public.void_payment(uuid, text) from public, anon;
-- Already restricted in 20261005074337; repeated so this file stands on its own.
revoke execute on function public.set_booking_status(uuid, public.booking_status, text) from public, anon;
revoke execute on function public.reschedule_booking(uuid, timestamptz, text) from public, anon;

grant execute on function public.staff_available_slots(date, integer, uuid) to authenticated;
grant execute on function public.create_staff_booking(uuid, timestamptz, uuid, text, text, text, uuid[], uuid, text) to authenticated;
grant execute on function public.assign_booking_staff(uuid, uuid) to authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, text, timestamptz, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz, text) to authenticated;
