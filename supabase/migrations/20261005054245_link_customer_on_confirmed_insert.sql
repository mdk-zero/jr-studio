-- The claim/create-customer logic only ran from the UPDATE trigger, which fires
-- when email_confirmed_at goes null -> not null. Users who are created ALREADY
-- confirmed never take that path, so they ended up with a profile but no
-- customers row and could not book. That affects:
--   * users created through the Auth admin API (email_confirm: true)
--   * staff invited by an admin
--   * any OAuth provider added later, where the email arrives pre-verified
--
-- The logic moves into one function called from both triggers.

create or replace function private.link_customer(p_user_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claimed uuid;
begin
  -- Claim a walk-in an admin created with the same email. Only ever called for
  -- a CONFIRMED address, so signing up as someone else cannot inherit their
  -- booking history.
  update public.customers c
     set profile_id = p_user_id,
         updated_at = now()
   where c.profile_id is null
     and lower(c.email) = lower(p_email)
   returning c.id into v_claimed;

  if v_claimed is null and not exists (
    select 1 from public.customers c where c.profile_id = p_user_id
  ) then
    insert into public.customers (profile_id, full_name, email, phone)
    select p.id, p.full_name, p.email, p.phone
      from public.profiles p where p.id = p_user_id;
  end if;
end;
$$;

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

  -- Created already confirmed (admin API, invite, pre-verified OAuth).
  if new.email_confirmed_at is not null then
    perform private.link_customer(new.id, new.email);
  end if;

  return new;
end;
$$;

create or replace function private.handle_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.link_customer(new.id, new.email);
  return new;
end;
$$;
