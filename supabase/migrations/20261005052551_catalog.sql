-- The single bookable catalog.
--
-- Legacy had TWO: customers booked `photoshoot_packages` while the admin wizard
-- booked `services`, and add-ons/promos attached only to services. Here every
-- bookable item is a package under a category, and add-ons and promotions
-- attach to packages, so both booking paths price identically.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  cover_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  -- Minutes, not free text. Legacy stored strings like '1.5 hours' and parsed
  -- them with intval(preg_replace(...)), turning that into a 15-hour booking.
  duration_minutes integer not null check (duration_minutes > 0),
  inclusions text[] not null default '{}',
  outfits integer check (outfits >= 0),
  backdrops integer check (backdrops >= 0),
  photos_included text,
  magazine_cover boolean not null default false,
  digital_images boolean not null default true,
  cover_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index packages_category_idx on public.packages (category_id);
create index packages_active_idx on public.packages (is_active, sort_order);

create table public.package_images (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  storage_path text not null,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index package_images_package_idx on public.package_images (package_id, sort_order);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.package_addons (
  package_id uuid not null references public.packages (id) on delete cascade,
  addon_id uuid not null references public.addons (id) on delete cascade,
  primary key (package_id, addon_id)
);
create index package_addons_addon_idx on public.package_addons (addon_id);

-- No stored status column: legacy kept one and never refreshed it, so the
-- public site advertised promos that had already ended. Status is derived
-- from the dates in Asia/Manila by the view below.
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_percent integer not null check (discount_percent between 1 and 100),
  starts_on date not null,
  ends_on date not null,
  visible_to_customers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_date_order check (ends_on >= starts_on)
);

create table public.promotion_packages (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete cascade,
  primary key (promotion_id, package_id)
);
create index promotion_packages_package_idx on public.promotion_packages (package_id);

-- security_invoker so the caller's RLS applies rather than the view owner's.
-- End date is inclusive, matching the legacy rule.
create view public.promotions_with_status
with (security_invoker = true) as
select
  p.*,
  case
    when (now() at time zone 'Asia/Manila')::date < p.starts_on then 'upcoming'
    when (now() at time zone 'Asia/Manila')::date > p.ends_on then 'expired'
    else 'active'
  end as status
from public.promotions p;
