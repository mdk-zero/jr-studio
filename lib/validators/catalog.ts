import { z } from "zod";

const name = z.string().trim().min(2, "Enter a name").max(120);
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null));

/** Accepts "1500", "1,500" or "1500.50" from a text input. */
const peso = z
  .string()
  .trim()
  .min(1, "Enter a price")
  .transform((v) => Number(v.replace(/,/g, "")))
  .pipe(
    z
      .number()
      .refine((n) => Number.isFinite(n), "Enter a valid amount")
      .min(0, "Price cannot be negative")
      .max(9_999_999),
  );

const optionalCount = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .pipe(z.number().int().min(0).max(999).nullable());

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name,
  description: optionalText,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: z.coerce.boolean().default(false),
});

export const packageSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid("Choose a category"),
  name,
  description: optionalText,
  price: peso,
  // Minutes, never free text: the legacy "1.5 hours" string became 15 hours.
  duration_minutes: z.coerce
    .number()
    .int("Use whole minutes")
    .min(5, "At least 5 minutes")
    .max(1440, "At most 24 hours"),
  // One per line in the textarea.
  inclusions: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  outfits: optionalCount,
  backdrops: optionalCount,
  photos_included: optionalText,
  magazine_cover: z.coerce.boolean().default(false),
  digital_images: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  addon_ids: z.array(z.string().uuid()).default([]),
});

export const addonSchema = z.object({
  id: z.string().uuid().optional(),
  name,
  description: optionalText,
  price: peso,
  is_active: z.coerce.boolean().default(false),
  package_ids: z.array(z.string().uuid()).default([]),
});

export const promotionSchema = z
  .object({
    id: z.string().uuid().optional(),
    name,
    discount_percent: z.coerce
      .number()
      .int()
      .min(1, "Discount must be at least 1%")
      .max(100, "Discount cannot exceed 100%"),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date"),
    ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an end date"),
    visible_to_customers: z.coerce.boolean().default(false),
    package_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => v.ends_on >= v.starts_on, {
    path: ["ends_on"],
    message: "The end date cannot be before the start date",
  });

export const idSchema = z.object({ id: z.string().uuid() });
