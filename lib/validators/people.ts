import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validators/auth";

export const CUSTOMER_TIERS = ["regular", "vip", "corporate"] as const;
export const STAFF_POSITIONS = [
  "photographer",
  "videographer",
  "makeup_artist",
  "assistant",
  "editor",
  "other",
] as const;

/** Empty inputs become null, so clearing a field clears the column. */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalEmail = z
  .union([emailSchema, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

const optionalPhone = z
  .union([phoneSchema, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

const optionalDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date"), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const customerListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  tier: z.enum(["all", ...CUSTOMER_TIERS]).catch("all"),
  status: z.enum(["active", "inactive", "all"]).catch("active"),
  account: z.enum(["all", "login", "walkin"]).catch("all"),
  marketing: z.enum(["all", "yes"]).catch("all"),
  sort: z.enum(["name", "newest"]).catch("name"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type CustomerListFilters = z.infer<typeof customerListSchema>;

export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2, "Enter the customer's name").max(100),
  email: optionalEmail,
  phone: optionalPhone,
  address: optional(200),
  tier: z.enum(CUSTOMER_TIERS).default("regular"),
  marketing_opt_in: z.boolean().default(false),
});

export const customerNoteSchema = z.object({
  customer_id: z.string().uuid(),
  body: z.string().trim().min(1, "Write the note first").max(2000),
});

export const customerStatusSchema = z.object({
  customer_id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export const staffSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2, "Enter a name").max(100),
  email: optionalEmail,
  phone: optionalPhone,
  address: optional(200),
  position: z.enum(STAFF_POSITIONS),
  birthday: optionalDate,
  hire_date: optionalDate,
  show_on_about: z.boolean().default(false),
  bio: optional(600),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const staffAccessSchema = z.object({
  staff_id: z.string().uuid(),
  // "none" revokes back-office access without deleting the account.
  role: z.enum(["staff", "admin", "none"]),
});

export const staffStatusSchema = z.object({
  staff_id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

/** A path in the `staff` bucket under the member's own folder. */
export const staffPhotoSchema = z.object({
  staff_id: z.string().uuid(),
  path: z.string().regex(/^[0-9a-f-]{36}\/[\w.-]{1,80}$/i, "Upload the photo first"),
});

// ---------------------------------------------------------------------------
// Bulk email
// ---------------------------------------------------------------------------
export const campaignSchema = z.object({
  // Generated when the form renders, so a double submit is the same campaign.
  campaign_key: z.string().uuid(),
  tier: z.enum(["all", ...CUSTOMER_TIERS]).default("all"),
  subject: z.string().trim().min(3, "Write a subject").max(150),
  body: z.string().trim().min(20, "Write at least a couple of sentences").max(10_000),
  confirm: z.literal("on", { message: "Tick the box to confirm the send" }),
});
