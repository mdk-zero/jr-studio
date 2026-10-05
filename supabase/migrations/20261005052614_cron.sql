-- Scheduled jobs.
--
-- Legacy expired bookings as a side effect of an admin GET, and its promo-status
-- script was never called at all. Promo status is now computed on read, and
-- expiry runs here on a schedule.

create extension if not exists pg_cron;

-- Idempotent: re-running this migration replaces the schedule rather than
-- failing or duplicating it.
select cron.unschedule('expire-pending-bookings')
where exists (select 1 from cron.job where jobname = 'expire-pending-bookings');

select cron.schedule(
  'expire-pending-bookings',
  '*/15 * * * *',
  $$ select private.expire_pending_bookings() $$
);
