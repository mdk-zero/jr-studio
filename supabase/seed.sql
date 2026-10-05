-- Development seed data for J&R Studio.
--
-- Repeatable: wipes app tables first, so it can be re-applied freely. It never
-- touches auth.users — real accounts come from signing up, and the first admin
-- is promoted with the SQL snippet in the README.
--
-- Prices and names are drawn from the legacy catalog so the data feels real.

truncate table
  public.payments,
  public.booking_events,
  public.booking_addons,
  public.bookings,
  public.feedback_requests,
  public.testimonials,
  public.portfolio_photos,
  public.albums,
  public.promotion_packages,
  public.promotions,
  public.package_addons,
  public.package_images,
  public.packages,
  public.categories,
  public.addons,
  public.customer_notes,
  public.customers,
  public.staff_members,
  public.contact_messages,
  public.email_log,
  public.blocked_dates
restart identity cascade;

-- ---------------------------------------------------------------------------
-- Categories: the legacy package categories and service categories, unified.
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, description, sort_order) values
  ('self-portrait', 'Self Portrait', 'Shoot yourself in our self-service studio, remote in hand.', 1),
  ('concept-shoot', 'Concept Shoot', 'Styled sets and props for a themed look.', 2),
  ('family',        'Family',        'Relaxed sessions for the whole family, kids welcome.', 3),
  ('baby',          'Baby',          'Milestone and newborn sessions at a gentle pace.', 4),
  ('prenup',        'Prenup',        'Pre-wedding shoots in studio or on location.', 5),
  ('wedding',       'Wedding',       'Full-day coverage for the ceremony and reception.', 6),
  ('debut',         'Debut',         'An 18th birthday, photographed properly.', 7),
  ('birthday',      'Birthday',      'Party and portrait coverage for any age.', 8),
  ('corporate',     'Corporate',     'Headshots, team portraits and company events.', 9);

-- ---------------------------------------------------------------------------
-- Packages. Duration is in MINUTES (legacy stored text like '1.5 hours').
-- ---------------------------------------------------------------------------
insert into public.packages
  (category_id, slug, name, description, price, duration_minutes, inclusions,
   outfits, backdrops, photos_included, magazine_cover, digital_images, sort_order)
select c.id, v.slug, v.name, v.description, v.price, v.duration_minutes, v.inclusions,
       v.outfits, v.backdrops, v.photos_included, v.magazine_cover, v.digital_images, v.sort_order
from (values
  ('self-portrait', 'self-studio-solo', 'Self Studio Solo',
   'Fifteen minutes of studio time, one backdrop, shutter remote in your hand.',
   350.00, 15, array['15 minutes studio time','1 backdrop','Remote shutter','All raw photos'], 1, 1, 'All shots', false, true, 1),
  ('self-portrait', 'self-studio-barkada', 'Self Studio Barkada',
   'Same self-service setup, more people, more time.',
   650.00, 30, array['30 minutes studio time','2 backdrops','Up to 6 people','All raw photos'], 1, 2, 'All shots', false, true, 2),
  ('concept-shoot', 'creative-props', 'Creative Props',
   'A styled set with our prop library and guided posing.',
   450.00, 20, array['20 minutes studio time','Prop styling','1 backdrop','5 edited photos'], 1, 1, '5 edited', false, true, 3),
  ('concept-shoot', 'magazine-concept', 'Magazine Concept',
   'A full editorial concept with a magazine-style cover layout.',
   4500.00, 120, array['2 hours studio time','3 outfit changes','Hair and makeup','Magazine cover layout','15 edited photos'], 3, 3, '15 edited', true, true, 4),
  ('concept-shoot', 'pro-portraits', 'Pro Portraits',
   'Guided portrait session with studio lighting.',
   600.00, 30, array['30 minutes studio time','Studio lighting','1 outfit','8 edited photos'], 1, 2, '8 edited', false, true, 5),
  ('family',        'family-session', 'Family Session',
   'A relaxed family shoot with time for the kids to settle in.',
   950.00, 45, array['45 minutes studio time','2 backdrops','Up to 8 people','12 edited photos'], 2, 2, '12 edited', false, true, 6),
  ('baby',          'baby-milestone', 'Baby Milestone',
   'Unhurried milestone session with props, blankets and plenty of breaks.',
   3500.00, 90, array['90 minutes studio time','Milestone props','2 outfit changes','20 edited photos'], 2, 3, '20 edited', false, true, 7),
  ('prenup',        'prenup-studio', 'Prenup Studio',
   'Pre-wedding session in the studio with two styled sets.',
   8500.00, 180, array['3 hours coverage','2 styled sets','3 outfit changes','Hair and makeup','40 edited photos','Online gallery'], 3, 2, '40 edited', false, true, 8),
  ('prenup',        'prenup-location', 'Prenup On Location',
   'On-location prenup shoot anywhere in Batangas.',
   14500.00, 300, array['5 hours coverage','Location scouting','Travel within Batangas','60 edited photos','Online gallery'], 4, 0, '60 edited', false, true, 9),
  ('wedding',       'wedding-full-day', 'Wedding Full Day',
   'Full-day coverage from preparation to reception, two photographers.',
   35000.00, 480, array['8 hours coverage','2 photographers','1 videographer','Same-day edit','300+ edited photos','Printed album','Online gallery'], 0, 0, '300+ edited', false, true, 10),
  ('debut',         'debut-package', 'Debut Package',
   'Debut coverage for the portraits and the programme.',
   15000.00, 300, array['5 hours coverage','2 photographers','18 roses coverage','100 edited photos','Printed album'], 2, 2, '100 edited', false, true, 11),
  ('birthday',      'birthday-party', 'Birthday Party',
   'Party coverage with candids and a short portrait set.',
   6500.00, 120, array['2 hours coverage','Candid and posed shots','50 edited photos','Online gallery'], 1, 1, '50 edited', false, true, 12),
  ('corporate',     'corporate-headshots', 'Corporate Headshots',
   'Clean, consistent headshots for teams.',
   2500.00, 60, array['1 hour studio time','Up to 10 people','Consistent lighting','2 edited photos each'], 1, 1, '2 each', false, true, 13)
) as v(category_slug, slug, name, description, price, duration_minutes, inclusions,
       outfits, backdrops, photos_included, magazine_cover, digital_images, sort_order)
join public.categories c on c.slug = v.category_slug;

-- ---------------------------------------------------------------------------
-- Add-ons, attached to the packages where they make sense.
-- ---------------------------------------------------------------------------
insert into public.addons (name, description, price) values
  ('Hair and Makeup',    'Professional HMUA on the day of the shoot.', 1500.00),
  ('Additional Outfit',  'One extra outfit change with styling.', 500.00),
  ('Extra Prints (10)',  'Ten 4R prints of your chosen photos.', 350.00),
  ('Rush Editing',       'Edited gallery delivered within 48 hours.', 1000.00),
  ('Second Photographer','An additional photographer for wider coverage.', 4000.00),
  ('Printed Album',      'A 20-page layflat printed album.', 2800.00);

-- Studio sessions: styling and print add-ons.
insert into public.package_addons (package_id, addon_id)
select p.id, a.id from public.packages p, public.addons a
 where p.slug in ('creative-props','pro-portraits','magazine-concept','family-session','baby-milestone')
   and a.name in ('Hair and Makeup','Additional Outfit','Extra Prints (10)','Rush Editing');

-- Event coverage: crew and album add-ons.
insert into public.package_addons (package_id, addon_id)
select p.id, a.id from public.packages p, public.addons a
 where p.slug in ('prenup-studio','prenup-location','wedding-full-day','debut-package','birthday-party')
   and a.name in ('Hair and Makeup','Second Photographer','Printed Album','Rush Editing');

-- ---------------------------------------------------------------------------
-- Promotions: one active, one upcoming, one expired, so the computed status
-- view and the "single highest active promo" pricing rule are both exercised.
-- ---------------------------------------------------------------------------
insert into public.promotions (name, discount_percent, starts_on, ends_on, visible_to_customers) values
  ('Studio Season Treat', 15,
    (now() at time zone 'Asia/Manila')::date - 3,
    (now() at time zone 'Asia/Manila')::date + 25, true),
  ('Wedding Early Bird', 10,
    (now() at time zone 'Asia/Manila')::date + 14,
    (now() at time zone 'Asia/Manila')::date + 60, true),
  ('Anniversary Sale', 20,
    (now() at time zone 'Asia/Manila')::date - 40,
    (now() at time zone 'Asia/Manila')::date - 10, true);

insert into public.promotion_packages (promotion_id, package_id)
select pr.id, p.id from public.promotions pr, public.packages p
 where pr.name = 'Studio Season Treat'
   and p.slug in ('self-studio-solo','self-studio-barkada','creative-props','pro-portraits','magazine-concept');

insert into public.promotion_packages (promotion_id, package_id)
select pr.id, p.id from public.promotions pr, public.packages p
 where pr.name = 'Wedding Early Bird' and p.slug in ('wedding-full-day','prenup-studio','prenup-location');

insert into public.promotion_packages (promotion_id, package_id)
select pr.id, p.id from public.promotions pr, public.packages p
 where pr.name = 'Anniversary Sale' and p.slug in ('family-session','birthday-party');

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
insert into public.staff_members
  (full_name, email, phone, position, hire_date, status, show_on_about, bio, sort_order) values
  ('Joed Tizon',      'joed@jrstudio.ph',   '09171234567', 'photographer',  '2023-01-15', 'active', true,  'Lead photographer. Shoots weddings and editorial.', 1),
  ('Rina Millan',     'rina@jrstudio.ph',   '09181234568', 'photographer',  '2023-06-01', 'active', true,  'Portrait and family specialist.', 2),
  ('Kai Devilla',     'kai@jrstudio.ph',    '09191234569', 'videographer',  '2024-02-20', 'active', true,  'Same-day edits and cinematic coverage.', 3),
  ('Mara Leynes',     'mara@jrstudio.ph',   '09201234570', 'makeup_artist', '2024-05-10', 'active', true,  'HMUA for shoots and events.', 4),
  ('Ton Bautista',    'ton@jrstudio.ph',    '09211234571', 'assistant',     '2025-03-03', 'active', false, 'Lighting and set assistant.', 5),
  ('Elle Sarmiento',  'elle@jrstudio.ph',   '09221234572', 'editor',        '2025-08-18', 'inactive', false, 'Retoucher. Currently on leave.', 6);

-- ---------------------------------------------------------------------------
-- Customers. All walk-ins (no login yet): profile_id stays null until someone
-- signs up with a matching verified email, which claims the row.
-- ---------------------------------------------------------------------------
insert into public.customers (full_name, email, phone, address, tier, status) values
  ('Andrea Salazar',  'andrea.salazar@example.com',  '09171110001', 'Balayan, Batangas',   'regular',   'active'),
  ('Mike Oquendo',    'mike.oquendo@example.com',    '09171110002', 'Nasugbu, Batangas',   'vip',       'active'),
  ('Carla Reyes',     'carla.reyes@example.com',     '09171110003', 'Lian, Batangas',      'regular',   'active'),
  ('Dennis Uy',       'dennis.uy@example.com',       '09171110004', 'Tuy, Batangas',       'corporate', 'active'),
  ('Joy Mendoza',     'joy.mendoza@example.com',     '09171110005', 'Calaca, Batangas',    'regular',   'active'),
  ('Paolo Villanueva','paolo.villanueva@example.com','09171110006', 'Nasugbu, Batangas',   'regular',   'inactive');

insert into public.customer_notes (customer_id, body)
select c.id, 'Repeat client. Prefers warm editing and morning slots.'
  from public.customers c where c.email = 'mike.oquendo@example.com';
insert into public.customer_notes (customer_id, body)
select c.id, 'Books team headshots every quarter. Invoice to the company.'
  from public.customers c where c.email = 'dennis.uy@example.com';

-- ---------------------------------------------------------------------------
-- Bookings across every status.
--
-- Active statuses (pending/approved/completed) must not overlap: the
-- bookings_no_overlap exclusion constraint would reject the seed. Each active
-- booking below is on a distinct day. Cancelled/rejected/expired rows may
-- overlap freely, which is the point of the partial constraint.
-- ---------------------------------------------------------------------------
insert into public.bookings
  (customer_id, package_id, staff_id, starts_at, ends_at, status,
   package_price, addons_total, discount_amount, total_amount, source, notes)
select
  c.id, p.id, s.id,
  v.starts_at,
  v.starts_at + make_interval(mins => p.duration_minutes),
  v.status::public.booking_status,
  p.price, v.addons_total, v.discount_amount,
  p.price + v.addons_total - v.discount_amount,
  v.source, v.notes
from (values
  -- Past, completed and fully paid.
  ('andrea.salazar@example.com','pro-portraits','Rina Millan',
    ((now() at time zone 'Asia/Manila')::date - 21 + time '10:00') at time zone 'Asia/Manila',
    'completed', 0.00, 0.00, 'customer', 'Graduation portraits.'),
  -- Past, completed, part-paid (balance outstanding).
  ('mike.oquendo@example.com','prenup-studio','Joed Tizon',
    ((now() at time zone 'Asia/Manila')::date - 14 + time '13:00') at time zone 'Asia/Manila',
    'completed', 1500.00, 1275.00, 'customer', 'Prenup with HMUA add-on.'),
  -- Past, completed, walk-in booked by the studio.
  ('dennis.uy@example.com','corporate-headshots','Rina Millan',
    ((now() at time zone 'Asia/Manila')::date - 9 + time '09:00') at time zone 'Asia/Manila',
    'completed', 0.00, 0.00, 'admin', 'Walk-in. Eight staff headshots.'),
  -- Upcoming, approved.
  ('carla.reyes@example.com','family-session','Rina Millan',
    ((now() at time zone 'Asia/Manila')::date + 3 + time '15:00') at time zone 'Asia/Manila',
    'approved', 350.00, 0.00, 'customer', 'Family of five. Requested prints.'),
  -- Upcoming, approved, with a deposit.
  ('mike.oquendo@example.com','wedding-full-day','Joed Tizon',
    ((now() at time zone 'Asia/Manila')::date + 20 + time '08:00') at time zone 'Asia/Manila',
    'approved', 6800.00, 0.00, 'customer', 'Church ceremony, reception at the resort.'),
  -- Awaiting studio approval.
  ('joy.mendoza@example.com','baby-milestone',null,
    ((now() at time zone 'Asia/Manila')::date + 6 + time '10:00') at time zone 'Asia/Manila',
    'pending', 0.00, 0.00, 'customer', 'Six-month milestone shoot.'),
  ('andrea.salazar@example.com','magazine-concept',null,
    ((now() at time zone 'Asia/Manila')::date + 9 + time '14:00') at time zone 'Asia/Manila',
    'pending', 1500.00, 900.00, 'customer', 'Editorial concept, wants the cover layout.'),
  -- Cancelled by the customer.
  ('carla.reyes@example.com','birthday-party',null,
    ((now() at time zone 'Asia/Manila')::date + 12 + time '16:00') at time zone 'Asia/Manila',
    'cancelled', 0.00, 0.00, 'customer', 'Cancelled, moving the party date.'),
  -- Declined by the studio (no crew that day).
  ('joy.mendoza@example.com','debut-package',null,
    ((now() at time zone 'Asia/Manila')::date + 12 + time '17:00') at time zone 'Asia/Manila',
    'rejected', 0.00, 0.00, 'customer', 'Declined: no crew available.'),
  -- Never approved, start time passed: what the cron job produces.
  ('paolo.villanueva@example.com','creative-props',null,
    ((now() at time zone 'Asia/Manila')::date - 5 + time '11:00') at time zone 'Asia/Manila',
    'expired', 0.00, 0.00, 'customer', 'No response from the customer.')
) as v(email, package_slug, staff_name, starts_at, status, addons_total, discount_amount, source, notes)
join public.customers c on c.email = v.email
join public.packages p on p.slug = v.package_slug
left join public.staff_members s on s.full_name = v.staff_name;

-- Add-on lines for the two bookings that have them, priced from the catalog.
insert into public.booking_addons (booking_id, addon_id, quantity, unit_price)
select b.id, a.id, 1, a.price
  from public.bookings b
  join public.packages p on p.id = b.package_id
  join public.addons a on a.name = 'Hair and Makeup'
 where p.slug in ('prenup-studio','magazine-concept');

insert into public.booking_addons (booking_id, addon_id, quantity, unit_price)
select b.id, a.id, 1, a.price
  from public.bookings b
  join public.packages p on p.id = b.package_id
  join public.addons a on a.name = 'Extra Prints (10)'
 where p.slug = 'family-session';

insert into public.booking_addons (booking_id, addon_id, quantity, unit_price)
select b.id, a.id, 1, a.price
  from public.bookings b
  join public.packages p on p.id = b.package_id
  join public.addons a on a.name in ('Second Photographer','Printed Album')
 where p.slug = 'wedding-full-day';

-- Audit trail, so the timeline UI has something to render.
insert into public.booking_events (booking_id, type, to_status, note, created_at)
select b.id, 'created', 'pending', 'Booking created during seeding', b.created_at
  from public.bookings b;
insert into public.booking_events (booking_id, type, from_status, to_status, note)
select b.id, 'status_changed', 'pending', b.status, 'Seeded status'
  from public.bookings b where b.status <> 'pending';

-- ---------------------------------------------------------------------------
-- Payments. Exercises every derived payment_status: paid, partial, unpaid
-- and refunded.
-- ---------------------------------------------------------------------------
-- Paid in full, in cash.
insert into public.payments (booking_id, amount, method, reference_no, paid_at, note)
select b.id, b.total_amount, 'cash', null, b.starts_at, 'Settled on the day'
  from public.bookings b join public.packages p on p.id = b.package_id
 where p.slug in ('pro-portraits','corporate-headshots');

-- Half now, balance on the day: 'partial'.
insert into public.payments (booking_id, amount, method, reference_no, paid_at, note)
select b.id, round(b.total_amount / 2, 2), 'gcash', 'GC-' || substr(b.id::text, 1, 8), b.created_at, 'Deposit'
  from public.bookings b join public.packages p on p.id = b.package_id
 where p.slug = 'prenup-studio';

-- Wedding deposit via bank transfer.
insert into public.payments (booking_id, amount, method, reference_no, paid_at, note)
select b.id, 10000.00, 'bank_transfer', 'BPI-884213', b.created_at, 'Reservation deposit'
  from public.bookings b join public.packages p on p.id = b.package_id
 where p.slug = 'wedding-full-day';

-- Cancelled booking: deposit taken, then refunded. Nets to zero -> 'refunded'.
insert into public.payments (booking_id, amount, method, reference_no, paid_at, note)
select b.id, 1000.00, 'gcash', 'GC-DEP-7781', b.created_at, 'Deposit'
  from public.bookings b join public.packages p on p.id = b.package_id
 where p.slug = 'birthday-party';
insert into public.payments (booking_id, amount, method, reference_no, paid_at, note)
select b.id, -1000.00, 'gcash', 'GC-RFD-7781', b.created_at + interval '2 days', 'Refunded after cancellation'
  from public.bookings b join public.packages p on p.id = b.package_id
 where p.slug = 'birthday-party';

-- ---------------------------------------------------------------------------
-- Testimonials: only for completed bookings, which is what the RLS insert
-- policy requires of customers too.
-- ---------------------------------------------------------------------------
insert into public.testimonials
  (customer_id, booking_id, package_id, rating, message, status, is_featured, reviewed_at)
select b.customer_id, b.id, b.package_id, v.rating, v.message,
       v.status::public.testimonial_status, v.is_featured,
       case when v.status = 'pending' then null else now() end
from (values
  ('pro-portraits', 5, 'Sobrang ganda ng results! Rina made me feel comfortable the whole time, and the photos came back in two days.', 'approved', true),
  ('prenup-studio', 5, 'Worth every peso. Joed found angles we never would have thought of, and the HMUA add-on was a great call.', 'approved', true),
  ('corporate-headshots', 4, 'Efficient and professional. Eight of us done in an hour, and the lighting is consistent across every shot.', 'approved', false)
) as v(package_slug, rating, message, status, is_featured)
join public.packages p on p.slug = v.package_slug
join public.bookings b on b.package_id = p.id and b.status = 'completed';

-- ---------------------------------------------------------------------------
-- Albums. Photos are added in Phase 6 with real uploads to Storage, so no rows
-- here point at files that do not exist.
-- ---------------------------------------------------------------------------
insert into public.albums (title, slug, category_id, description)
select v.title, v.slug, c.id, v.description
from (values
  ('Weddings 2026',        'weddings-2026',        'wedding',       'Selected frames from this year''s weddings.'),
  ('Studio Portraits',     'studio-portraits',     'concept-shoot', 'Editorial and portrait work shot in studio.'),
  ('Families and Babies',  'families-and-babies',  'family',        'Family sessions and milestone shoots.')
) as v(title, slug, category_slug, description)
join public.categories c on c.slug = v.category_slug;

-- ---------------------------------------------------------------------------
-- Inbox
-- ---------------------------------------------------------------------------
insert into public.contact_messages (name, email, phone, message, is_read) values
  ('Liza Ramos', 'liza.ramos@example.com', '09331110007',
   'Hi! Do you have a package for a 50th wedding anniversary? Around 30 guests.', false),
  ('Grace Tan', 'grace.tan@example.com', '09331110008',
   'Magkano po ang self studio for 4 people? Available ba sa Sunday?', true);

-- ---------------------------------------------------------------------------
-- Studio profile
-- ---------------------------------------------------------------------------
update public.studio_settings set
  studio_name = 'J&R Studio',
  phone = '09178319472',
  email = 'hello@jrstudio.ph',
  address = 'Miralles Street, Brgy. 3JGP+4J4, Nasugbu, 4231 Batangas',
  map_url = 'https://maps.google.com/?q=J%26R+Studio+Nasugbu+Batangas',
  socials = '{"facebook":"https://facebook.com/jrstudio","instagram":"https://instagram.com/jrstudio","tiktok":"https://tiktok.com/@jrstudio"}'::jsonb
where id;

-- Studio is closed on Sundays; Christmas Day blocked as an example holiday.
insert into public.blocked_dates (blocked_on, reason) values
  (date_trunc('year', (now() at time zone 'Asia/Manila'))::date + interval '11 months' + interval '24 days',
   'Christmas Day')
on conflict (blocked_on) do nothing;
