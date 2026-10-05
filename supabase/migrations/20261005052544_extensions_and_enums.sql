-- Extensions, schemas and enums.
--
-- btree_gist is required so the bookings exclusion constraint can combine a
-- uuid equality (staff_id) with a range overlap (slot) in one GiST index.

create extension if not exists btree_gist with schema extensions;
-- gen_random_bytes(), used for feedback-request tokens.
create extension if not exists pgcrypto with schema extensions;

-- Helper functions live here so they are NOT reachable through the Data API.
-- Anything SECURITY DEFINER belongs in this schema, never in public.
create schema if not exists private;

create type public.user_role as enum ('admin', 'staff', 'customer');

create type public.booking_status as enum (
  'pending',    -- customer request awaiting studio approval
  'approved',   -- confirmed by the studio
  'completed',  -- shoot happened
  'cancelled',  -- called off by customer or studio
  'rejected',   -- declined by the studio
  'expired'     -- start time passed while still pending (set by cron)
);

create type public.payment_method as enum ('cash', 'gcash', 'bank_transfer', 'card', 'other');

create type public.staff_position as enum (
  'photographer', 'videographer', 'makeup_artist', 'assistant', 'editor', 'other'
);

create type public.customer_tier as enum ('regular', 'vip', 'corporate');

create type public.testimonial_status as enum ('pending', 'approved', 'rejected');

create type public.entity_status as enum ('active', 'inactive');
