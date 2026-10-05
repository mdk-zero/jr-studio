-- Least privilege for the anonymous role.
--
-- Supabase's default privileges grant anon broad table access, so an anon
-- request to /rest/v1/customers returned an empty array (RLS filtered it)
-- rather than "permission denied". RLS was doing its job, but that makes RLS
-- the only thing standing between a visitor and private data. Privileges are
-- narrowed here so a future policy mistake cannot expose these tables.

-- Nothing anonymous ever touches these.
revoke all on
  public.profiles,
  public.customers,
  public.customer_notes,
  public.bookings,
  public.booking_addons,
  public.booking_events,
  public.payments,
  public.booking_payment_summary,
  public.email_log,
  public.feedback_requests
from anon;

-- Contact form: a visitor may submit, never read the inbox.
revoke all on public.contact_messages from anon;
grant insert on public.contact_messages to anon;

-- Public surfaces are read-only for visitors.
revoke all on
  public.categories,
  public.packages,
  public.package_images,
  public.addons,
  public.package_addons,
  public.promotions,
  public.promotion_packages,
  public.promotions_with_status,
  public.albums,
  public.portfolio_photos,
  public.testimonials,
  public.staff_members,
  public.studio_settings,
  public.business_hours,
  public.blocked_dates
from anon;

grant select on
  public.categories,
  public.packages,
  public.package_images,
  public.addons,
  public.package_addons,
  public.promotions,
  public.promotion_packages,
  public.promotions_with_status,
  public.albums,
  public.portfolio_photos,
  public.testimonials,
  public.staff_members,
  public.studio_settings,
  public.business_hours,
  public.blocked_dates
to anon;
