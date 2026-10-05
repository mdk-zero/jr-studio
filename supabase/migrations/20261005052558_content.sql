-- Portfolio, testimonials, contact inbox and the email log.

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category_id uuid references public.categories (id) on delete set null,
  description text,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.albums (id) on delete set null,
  package_id uuid references public.packages (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  title text,
  description text,
  -- Path in the `portfolio` storage bucket. Legacy kept a longblob column plus
  -- a path column and used them inconsistently.
  storage_path text not null,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index portfolio_photos_album_idx on public.portfolio_photos (album_id, sort_order);
create index portfolio_photos_category_idx on public.portfolio_photos (category_id);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  package_id uuid references public.packages (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  message text not null check (length(trim(message)) > 0),
  status public.testimonial_status not null default 'pending',
  -- A flag, not a status value. Legacy had 'featured' in the status enum AND a
  -- separate boolean column, so the two could disagree.
  is_featured boolean not null default false,
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- One testimonial per booking.
  unique (booking_id)
);
create index testimonials_public_idx on public.testimonials (status, is_featured, created_at desc);
create index testimonials_customer_idx on public.testimonials (customer_id);

-- Tokenised "please review your shoot" links for completed bookings.
create table public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  sent_at timestamptz not null default now(),
  completed_at timestamptz
);
create index feedback_requests_booking_idx on public.feedback_requests (booking_id);

-- Legacy's contact form posted to nothing; messages were lost in the URL.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  email text not null,
  phone text,
  message text not null check (length(trim(message)) > 0),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index contact_messages_unread_idx on public.contact_messages (is_read, created_at desc);

-- Audit of what was sent, so bulk email cannot silently double-send.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  template text not null,
  status text not null default 'sent',
  provider_id text,
  error text,
  booking_id uuid references public.bookings (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);
