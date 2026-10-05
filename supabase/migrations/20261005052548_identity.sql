-- Identity: auth accounts, customers (including walk-ins) and staff.
--
-- Replaces the legacy users/admins/clients/staff tangle, where login was tried
-- against three tables in sequence and the "Staffs" page actually managed admin
-- logins. Here: profiles = one row per auth account (carrying the role),
-- customers = anyone who can be booked (with or without a login),
-- staff_members = people who can be assigned to a shoot.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role public.user_role not null default 'customer',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'Authoritative role. Read live (not from a JWT claim) so revoking access takes effect immediately.';

-- Customers may exist without a login: admins create walk-ins, which are later
-- claimed when someone signs up with the same verified email.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  address text,
  tier public.customer_tier not null default 'regular',
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness without needing the citext extension.
create unique index customers_email_lower_key
  on public.customers (lower(email)) where email is not null;
create index customers_status_idx on public.customers (status);

-- One row per note, instead of appending timestamped lines into a single
-- TEXT column as the legacy system did.
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  -- Set only when this person also has a login.
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  address text,
  position public.staff_position not null default 'photographer',
  birthday date,
  hire_date date,
  status public.entity_status not null default 'active',
  show_on_about boolean not null default false,
  bio text,
  photo_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_members_status_idx on public.staff_members (status);
