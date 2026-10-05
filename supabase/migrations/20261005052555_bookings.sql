-- Bookings, add-on lines, audit trail and the payment ledger.

set local search_path = public, extensions;

create sequence public.booking_reference_seq;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- restrict: a package that has been booked cannot be deleted out from under
  -- its history. Legacy cascaded, which erased what past bookings were for.
  package_id uuid not null references public.packages (id) on delete restrict,
  staff_id uuid references public.staff_members (id) on delete set null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Generated so the range can never drift from its endpoints.
  slot tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  status public.booking_status not null default 'pending',

  -- Price snapshot: what was agreed at booking time, immune to later catalog edits.
  package_price numeric(10, 2) not null check (package_price >= 0),
  addons_total numeric(10, 2) not null default 0 check (addons_total >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  promotion_id uuid references public.promotions (id) on delete set null,

  notes text,
  source text not null check (source in ('customer', 'admin')),
  created_by uuid references public.profiles (id) on delete set null,

  -- Supports the 5-minute undo without keeping state in a PHP session, which
  -- legacy did (so undo was lost on logout or another device).
  cancelled_at timestamptz,
  status_before_cancel public.booking_status,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_time_order check (ends_at > starts_at)
);

-- One session at a time, studio-wide. This is the whole double-booking defence:
-- a concurrent insert for an overlapping slot fails with SQLSTATE 23P01 rather
-- than racing past a SELECT-then-INSERT check as the legacy code did.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (slot with &&)
  where (status in ('pending', 'approved', 'completed'));

-- A staff member also cannot be in two places at once.
alter table public.bookings
  add constraint bookings_staff_no_overlap
  exclude using gist (staff_id with =, slot with &&)
  where (staff_id is not null and status in ('pending', 'approved', 'completed'));

create index bookings_starts_at_idx on public.bookings (starts_at);
create index bookings_status_starts_idx on public.bookings (status, starts_at);
create index bookings_customer_idx on public.bookings (customer_id, starts_at desc);
create index bookings_staff_idx on public.bookings (staff_id, starts_at) where staff_id is not null;
create index bookings_package_idx on public.bookings (package_id);

create table public.booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  addon_id uuid not null references public.addons (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  -- Snapshot, so later price changes don't rewrite history.
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  unique (booking_id, addon_id)
);

-- Audit timeline. Legacy appended strings like ' (System Approved)' and
-- ' (Cancelled by customer on …)' into the notes column, which then had to be
-- parsed to reconstruct history.
create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null,
  from_status public.booking_status,
  to_status public.booking_status,
  note text,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- The ledger the legacy system defined but never wrote to, which is why its
-- dashboard revenue was permanently zero.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  -- Negative amounts are refunds; zero is meaningless.
  amount numeric(10, 2) not null check (amount <> 0),
  method public.payment_method not null default 'cash',
  reference_no text,
  receipt_path text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id, paid_at);

-- Payment status is DERIVED from the ledger, never stored and hand-edited.
create view public.booking_payment_summary
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
left join public.payments p on p.booking_id = b.id
group by b.id, b.total_amount;
