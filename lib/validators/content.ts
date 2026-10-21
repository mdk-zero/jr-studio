import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validators/auth";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalUrl = z
  .union([z.string().trim().url("Enter a full link, starting with https://").max(300), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
export const TESTIMONIAL_STATUSES = ["pending", "approved", "rejected"] as const;

export const testimonialListSchema = z.object({
  status: z.enum(["all", ...TESTIMONIAL_STATUSES]).catch("pending"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const moderateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TESTIMONIAL_STATUSES),
});

export const featureSchema = z.object({
  id: z.string().uuid(),
  is_featured: z.boolean(),
});

export const testimonialEditSchema = z.object({
  id: z.string().uuid(),
  author_name: z.string().trim().min(1, "Enter a display name").max(80),
  message: z.string().trim().min(1, "The review cannot be empty").max(2000),
  admin_notes: optional(1000),
});

/** What a customer writes, from the review link or their account. */
export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5, "Choose a rating"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  author_name: z.string().trim().min(2, "How should we credit you?").max(80),
});

export const feedbackTokenSchema = z.string().regex(/^[0-9a-f]{48}$/);

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: emailSchema,
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(3000),
  // A field real visitors never see. Bots that fill every input fill this one.
  website: z.string().max(0).optional(),
});

export const messageListSchema = z.object({
  filter: z.enum(["unread", "all"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export const studioDetailsSchema = z.object({
  studio_name: z.string().trim().min(2).max(80),
  phone: optional(30),
  email: z
    .union([emailSchema, z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  address: optional(200),
  map_url: optionalUrl,
  facebook: optionalUrl,
  instagram: optionalUrl,
  tiktok: optionalUrl,
});

export const bookingRulesSchema = z.object({
  slot_interval_minutes: z.coerce.number().int().min(5).max(240),
  min_lead_hours: z.coerce.number().int().min(0).max(720),
  max_advance_days: z.coerce.number().int().min(1).max(730),
  cancel_cutoff_hours: z.coerce.number().int().min(0).max(720),
  undo_window_seconds: z.coerce.number().int().min(0).max(3600),
});

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM");

export const businessHoursSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      is_open: z.boolean(),
      opens_at: time,
      closes_at: time,
    }),
  )
  .length(7)
  .superRefine((days, ctx) => {
    days.forEach((day, index) => {
      if (day.is_open && day.closes_at.slice(0, 5) <= day.opens_at.slice(0, 5)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "closes_at"],
          message: "Closing time must be after opening time",
        });
      }
    });
  });

export const blockedDateSchema = z.object({
  blocked_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  reason: optional(120),
});

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
export const albumSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Give the album a title").max(120),
  category_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  description: optional(600),
});

/** Uploaded straight to Storage by the browser; the server only records it. */
export const photoPathSchema = z
  .string()
  .regex(/^(loose|[0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpe?g|png|webp|avif)$/i);

export const registerPhotosSchema = z.object({
  album_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  photos: z
    .array(
      z.object({
        path: photoPathSchema,
        width: z.number().int().min(1).max(20_000).nullable(),
        height: z.number().int().min(1).max(20_000).nullable(),
        title: optional(120),
      }),
    )
    .min(1)
    .max(50),
});

export const photoUpdateSchema = z.object({
  id: z.string().uuid(),
  title: optional(120),
  album_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});
