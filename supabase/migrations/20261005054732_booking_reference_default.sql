-- `reference` was NOT NULL with no default, filled by a BEFORE INSERT trigger.
-- The database was happy, but the generated TypeScript types marked it as a
-- required field on every insert, pushing a value callers should never supply
-- into application code. A column default expresses the same thing and makes
-- the generated type optional, so the trigger is no longer needed.

alter table public.bookings
  alter column reference
  set default 'JR-' || lpad(nextval('public.booking_reference_seq')::text, 5, '0');

drop trigger set_booking_reference on public.bookings;
drop function private.set_booking_reference();
