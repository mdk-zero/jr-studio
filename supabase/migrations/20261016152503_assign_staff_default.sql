-- assign_booking_staff(p_booking_id, p_staff_id) had no default for p_staff_id,
-- so there was no way to call it for "unassign": supabase-js drops a null
-- argument from the request, and PostgREST then finds no function matching
-- (p_booking_id) alone. Omitting the staff member now means unassigning.
-- The body is unchanged.

create or replace function public.assign_booking_staff(p_booking_id uuid, p_staff_id uuid default null)
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
