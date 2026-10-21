import { z } from "zod";

export const createBookingSchema = z.object({
  package_id: z.string().uuid("Choose a package"),
  // Full ISO instant, taken from a slot the server offered.
  starts_at: z.string().datetime({ offset: true }),
  addon_ids: z.array(z.string().uuid()).max(20).default([]),
  notes: z.string().trim().max(1000).optional(),
});

export const bookingIdSchema = z.object({ booking_id: z.string().uuid() });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z
    .union([z.string().trim().regex(/^(\+63|0)9\d{9}$/, "Enter a PH mobile number"), z.literal("")])
    .optional(),
  address: z.string().trim().max(300).optional(),
  marketing_opt_in: z.boolean().default(false),
});
