-- Supabase grants EXECUTE on public functions to `anon` and `authenticated`
-- directly (via ALTER DEFAULT PRIVILEGES), so revoking from PUBLIC in the
-- previous migration did not remove anonymous access. Verified by calling
-- /rest/v1/rpc/cancel_booking with only the publishable key: it still reached
-- the function body and failed on its internal check instead of being refused.
--
-- The booking RPCs require a session, so anon loses EXECUTE outright.
-- quote_booking and available_slots stay callable by anon on purpose.

revoke execute on function public.create_booking(uuid, timestamptz, uuid[], text) from anon;
revoke execute on function public.cancel_booking(uuid) from anon;
revoke execute on function public.undo_cancel_booking(uuid) from anon;
