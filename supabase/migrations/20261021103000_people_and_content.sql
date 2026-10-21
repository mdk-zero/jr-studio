-- Phase 6: people and content.
--
-- Customers gain marketing consent and an unsubscribe token, and can no longer
-- edit their own tier, status or email. Studio logins get guard rails: nobody
-- changes their own role and the last admin cannot be demoted. Reviews can be
-- requested by a tokenised link that works without an account (most walk-ins
-- never sign up). The contact form moves behind the app so it can be rate
-- limited by IP, and the email log can de-duplicate a bulk send.

-- ---------------------------------------------------------------------------
-- Customers: marketing consent
-- ---------------------------------------------------------------------------
alter table public.customers
  add column marketing_opt_in boolean not null default false,
  add column marketing_opt_in_at timestamptz,
  -- Lets an email's unsubscribe link work without signing in. The default is
  -- volatile, so every existing row gets its own value.
  add column unsubscribe_token text not null
    default encode(extensions.gen_random_bytes(16), 'hex');

alter table public.customers
  add constraint customers_unsubscribe_token_key unique (unsubscribe_token);

comment on column public.customers.marketing_opt_in is
  'Consent to promotional email. Bulk email goes only to customers where this is true.';

-- The consent timestamp is evidence, so it is set here and never taken from a
-- client: it records when the box was ticked, and clears when it is unticked.
create or replace function private.stamp_marketing_consent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() end;
  elsif new.marketing_opt_in is distinct from old.marketing_opt_in then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() end;
  else
    new.marketing_opt_in_at := old.marketing_opt_in_at;
  end if;
  return new;
end;
$$;

create trigger stamp_marketing_consent before insert or update on public.customers
  for each row execute function private.stamp_marketing_consent();

-- RLS lets a customer update their own row, which also let them set their own
-- tier, deactivate themselves, or change the email a walk-in claim matches on.
-- WITH CHECK cannot see the old row, so the rule lives in a trigger.
create or replace function private.guard_customer_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Trusted contexts (secret key, Auth's own triggers, SQL editor) and staff.
  if (select auth.uid()) is null or private.is_staff_or_admin() then
    return new;
  end if;

  if new.tier is distinct from old.tier
     or new.status is distinct from old.status
     or new.email is distinct from old.email
     or new.profile_id is distinct from old.profile_id
     or new.unsubscribe_token is distinct from old.unsubscribe_token then
    raise exception 'Only the studio can change that' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard_customer_update before update on public.customers
  for each row execute function private.guard_customer_update();

-- Signup can carry consent (the checkbox on the form). It is added to a
-- claimed walk-in's existing consent, never used to withdraw it: an unticked
-- box is not a decision to unsubscribe.
--
-- Studio logins are skipped. A staff invite sets the role before the invitee
-- confirms, so accepting the invite no longer creates a customer record.
create or replace function private.link_customer(p_user_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claimed uuid;
  v_opt_in boolean;
begin
  if exists (
    select 1 from public.profiles p where p.id = p_user_id and p.role <> 'customer'
  ) then
    return;
  end if;

  select coalesce(u.raw_user_meta_data ->> 'marketing_opt_in', '') = 'true'
    into v_opt_in
    from auth.users u where u.id = p_user_id;
  v_opt_in := coalesce(v_opt_in, false);

  -- Claim a walk-in an admin created with the same email. Only ever called for
  -- a CONFIRMED address, so signing up as someone else cannot inherit their
  -- booking history.
  update public.customers c
     set profile_id = p_user_id,
         marketing_opt_in = c.marketing_opt_in or v_opt_in,
         updated_at = now()
   where c.profile_id is null
     and lower(c.email) = lower(p_email)
   returning c.id into v_claimed;

  if v_claimed is null and not exists (
    select 1 from public.customers c where c.profile_id = p_user_id
  ) then
    insert into public.customers (profile_id, full_name, email, phone, marketing_opt_in)
    select p.id, p.full_name, p.email, p.phone, v_opt_in
      from public.profiles p where p.id = p_user_id;
  end if;
end;
$$;

-- Bookings, completed sessions and money paid, per customer. security_invoker,
-- so the underlying RLS applies: staff see everyone, a customer only themself.
create view public.customer_summary with (security_invoker = true) as
select
  c.id as customer_id,
  count(distinct b.id) filter (where b.status in ('pending', 'approved', 'completed')) as bookings_count,
  count(distinct b.id) filter (where b.status = 'completed') as completed_count,
  max(b.starts_at) filter (where b.status in ('approved', 'completed') and b.starts_at <= now()) as last_session_at,
  min(b.starts_at) filter (where b.status in ('pending', 'approved') and b.starts_at > now()) as next_session_at,
  coalesce(sum(p.amount) filter (where p.voided_at is null), 0)::numeric(12, 2) as total_paid
from public.customers c
left join public.bookings b on b.customer_id = c.id
left join public.payments p on p.booking_id = b.id
group by c.id;

revoke all on public.customer_summary from anon, authenticated;
grant select on public.customer_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Customer notes: the author is whoever is signed in, not a posted value.
-- ---------------------------------------------------------------------------
alter table public.customer_notes alter column author_id set default auth.uid();

drop policy "staff write customer notes" on public.customer_notes;
create policy "staff write customer notes" on public.customer_notes
  for insert to authenticated
  with check (private.is_staff_or_admin() and author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Studio logins
-- ---------------------------------------------------------------------------
alter table public.staff_members add column invited_at timestamptz;

create or replace function private.guard_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for trusted server contexts (secret key, cron, SQL
    -- editor); an end user must be an admin, and not acting on themself.
    if (select auth.uid()) is not null then
      if not private.is_admin() then
        raise exception 'Only an admin can change a role' using errcode = '42501';
      end if;
      if (select auth.uid()) = new.id then
        raise exception 'You cannot change your own role' using errcode = '42501';
      end if;
    end if;

    -- Applies to trusted contexts too: no path leaves the studio without an admin.
    if old.role = 'admin' and not exists (
      select 1 from public.profiles p where p.role = 'admin' and p.id <> old.id
    ) then
      raise exception 'The studio needs at least one admin' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Testimonials: moderation
-- ---------------------------------------------------------------------------

-- Staff may moderate and correct the wording (a phone number pasted into a
-- review, a typo in the display name), but not reassign a review to another
-- customer or booking. Who reviewed it, and when, is stamped by the trigger.
revoke update on public.testimonials from authenticated;
grant update (status, is_featured, admin_notes, message, author_name)
  on public.testimonials to authenticated;

create or replace function private.stamp_testimonial_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := (select auth.uid());
  end if;
  -- Only a published review can be featured on the home page.
  if new.status <> 'approved' then
    new.is_featured := false;
  end if;
  return new;
end;
$$;

create trigger stamp_testimonial_review before update on public.testimonials
  for each row execute function private.stamp_testimonial_review();

-- ---------------------------------------------------------------------------
-- Feedback requests
--
-- A completed session can be sent a review link. The token is the only
-- credential, so a walk-in without an account can still leave a review, and
-- the link expires after 60 days. Re-sending reuses the open link, so an older
-- email still works and there is never more than one open request per booking.
-- ---------------------------------------------------------------------------
create unique index feedback_requests_open_key
  on public.feedback_requests (booking_id) where completed_at is null;

create or replace function private.complete_feedback_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Covers both paths: the token form and a signed-in customer's own form.
  if new.booking_id is not null then
    update public.feedback_requests
       set completed_at = now()
     where booking_id = new.booking_id and completed_at is null;
  end if;
  return new;
end;
$$;

create trigger complete_feedback_request after insert on public.testimonials
  for each row execute function private.complete_feedback_request();

create or replace function public.request_feedback(p_booking_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_status public.booking_status;
  v_token text;
begin
  if not private.is_staff_or_admin() then
    raise exception 'Only studio staff can request a review' using errcode = '42501';
  end if;

  select b.status into v_status from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_status <> 'completed' then
    raise exception 'A review can only be requested once the session is completed';
  end if;
  if exists (select 1 from public.testimonials t where t.booking_id = p_booking_id) then
    raise exception 'This session already has a review' using errcode = '23505';
  end if;

  update public.feedback_requests
     set sent_at = now()
   where booking_id = p_booking_id and completed_at is null
  returning token into v_token;

  if v_token is null then
    insert into public.feedback_requests (booking_id)
    values (p_booking_id)
    returning token into v_token;
  end if;

  return v_token;
end;
$$;

create or replace function public.get_feedback_request(p_token text)
returns table (state text, first_name text, package_name text, session_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    case
      when fr.completed_at is not null
        or exists (select 1 from public.testimonials t where t.booking_id = fr.booking_id)
        then 'done'
      when fr.sent_at < now() - interval '60 days' then 'expired'
      else 'open'
    end,
    split_part(c.full_name, ' ', 1),
    p.name,
    b.starts_at
  from public.feedback_requests fr
  join public.bookings b on b.id = fr.booking_id
  join public.customers c on c.id = b.customer_id
  left join public.packages p on p.id = b.package_id
  where fr.token = p_token;
$$;

create or replace function public.submit_feedback(
  p_token text,
  p_rating integer,
  p_message text,
  p_author_name text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.feedback_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_id uuid;
begin
  select * into v_request
    from public.feedback_requests fr
   where fr.token = p_token
     for update;

  if not found then
    raise exception 'This review link is not valid' using errcode = 'P0002';
  end if;
  if v_request.completed_at is not null then
    raise exception 'Your review is already in. Thank you!' using errcode = '23505';
  end if;
  if v_request.sent_at < now() - interval '60 days' then
    raise exception 'This review link has expired. Ask the studio for a new one.';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose a rating from 1 to 5 stars' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_message, ''))) = 0 or length(p_message) > 2000 then
    raise exception 'Write a review of up to 2,000 characters' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_author_name, ''))) = 0 or length(p_author_name) > 80 then
    raise exception 'Tell us how to credit you (up to 80 characters)' using errcode = '22023';
  end if;

  select * into v_booking from public.bookings b where b.id = v_request.booking_id;

  -- Unique on booking_id: a review already left from the account page raises
  -- 23505 here, which reads the same as "already in".
  insert into public.testimonials
    (customer_id, booking_id, package_id, rating, message, author_name)
  values
    (v_booking.customer_id, v_booking.id, v_booking.package_id, p_rating,
     trim(p_message), trim(p_author_name))
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unsubscribe by token, from any email, without signing in.
-- ---------------------------------------------------------------------------
create or replace function public.unsubscribe_marketing(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return false;
  end if;

  update public.customers
     set marketing_opt_in = false
   where unsubscribe_token = p_token;

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contact inbox
--
-- Visitors could INSERT straight through the Data API with the public key,
-- which no app-level rate limit can see. Messages now arrive only through the
-- app's server action (secret key), which limits by IP and by sender. The
-- hash is a salted SHA-256 of the IP, so the raw address is never stored.
-- ---------------------------------------------------------------------------
alter table public.contact_messages add column client_hash text;
create index contact_messages_client_idx on public.contact_messages (client_hash, created_at desc);
create index contact_messages_email_idx on public.contact_messages (lower(email), created_at desc);

drop policy "anyone can send a message" on public.contact_messages;
revoke insert on public.contact_messages from anon, authenticated;

-- Staff mark messages read; the message itself is what the visitor wrote.
revoke update on public.contact_messages from authenticated;
grant update (is_read) on public.contact_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Email log
--
-- A bulk send writes one row per recipient BEFORE sending, keyed by the
-- campaign. Submitting the same form twice (a double click, a retry after a
-- timeout) finds the rows already there and sends nothing new.
--
-- Not a partial index: PostgREST's on_conflict cannot name an index predicate,
-- and NULLs never collide, so one-off emails (no campaign) are unaffected. The
-- app lowercases campaign addresses before writing them.
-- ---------------------------------------------------------------------------
alter table public.email_log
  add column customer_id uuid references public.customers (id) on delete set null,
  add column campaign_key text;

create unique index email_log_campaign_recipient_key
  on public.email_log (campaign_key, to_email);
create index email_log_customer_idx on public.email_log (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function private.stamp_marketing_consent() from public;
revoke execute on function private.guard_customer_update() from public;
revoke execute on function private.stamp_testimonial_review() from public;
revoke execute on function private.complete_feedback_request() from public;

revoke execute on function public.request_feedback(uuid) from public, anon;
revoke execute on function public.get_feedback_request(text) from public;
revoke execute on function public.submit_feedback(text, integer, text, text) from public;
revoke execute on function public.unsubscribe_marketing(text) from public;

grant execute on function public.request_feedback(uuid) to authenticated;
-- Token-gated, so reachable without an account.
grant execute on function public.get_feedback_request(text) to anon, authenticated;
grant execute on function public.submit_feedback(text, integer, text, text) to anon, authenticated;
grant execute on function public.unsubscribe_marketing(text) to anon, authenticated;
