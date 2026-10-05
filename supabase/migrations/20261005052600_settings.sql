-- Studio configuration. Legacy hardcoded all of this: business hours lived in
-- two different places (08:00-20:00 in the admin slot generator, a fixed list
-- of 8-11am/1-5pm in the customer page), and the Settings link was dead.

-- Single-row table: the `id` CHECK makes a second row impossible.
create table public.studio_settings (
  id boolean primary key default true check (id),
  studio_name text not null default 'J&R Studio',
  phone text,
  email text,
  address text,
  map_url text,
  socials jsonb not null default '{}'::jsonb,
  slot_interval_minutes integer not null default 60 check (slot_interval_minutes between 5 and 240),
  min_lead_hours integer not null default 24 check (min_lead_hours >= 0),
  max_advance_days integer not null default 90 check (max_advance_days > 0),
  cancel_cutoff_hours integer not null default 24 check (cancel_cutoff_hours >= 0),
  undo_window_seconds integer not null default 300 check (undo_window_seconds >= 0),
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  updated_at timestamptz not null default now()
);

insert into public.studio_settings (id) values (true);

-- 0 = Sunday, matching extract(dow) and lib/datetime.ts manilaWeekday().
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time not null default '08:00',
  closes_at time not null default '20:00',
  constraint business_hours_order check (closes_at > opens_at)
);

insert into public.business_hours (weekday, is_open) values
  (0, false), (1, true), (2, true), (3, true), (4, true), (5, true), (6, true);

create table public.blocked_dates (
  blocked_on date primary key,
  reason text
);
