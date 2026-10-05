-- Public testimonials need a name to display, but `anon` has no access to
-- public.customers and should not get it just to render a review. The legacy
-- landing page joined clients to testimonials for exactly this, which is why it
-- needed to read the customer table from the public site.
--
-- The name is captured on the testimonial instead: the reviewer chooses how they
-- are credited, and nothing else about the customer is exposed.

alter table public.testimonials
  add column author_name text;

comment on column public.testimonials.author_name is
  'Display name shown publicly, e.g. "Andrea S." Captured at submission so the public site never reads customers.';

-- Customers may set their own display name when submitting, but still cannot
-- self-approve or self-feature.
drop policy "customers review own completed bookings" on public.testimonials;
create policy "customers review own completed bookings" on public.testimonials
  for insert to authenticated
  with check (
    customer_id = private.current_customer_id()
    and status = 'pending'
    and is_featured = false
    and exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and b.customer_id = private.current_customer_id()
         and b.status = 'completed'
    )
  );
