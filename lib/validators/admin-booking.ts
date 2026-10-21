import { z } from "zod";
import { PAYMENT_METHODS, STAFF_STATUS_ACTIONS } from "@/lib/booking-status";
import { manilaDateTimeLocalToUtc } from "@/lib/datetime";

const note = z.string().trim().max(500).optional();
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const statusChangeSchema = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(STAFF_STATUS_ACTIONS),
  note,
});

export const rescheduleSchema = z.object({
  booking_id: z.string().uuid(),
  // Full ISO instant, taken from a slot staff_available_slots offered.
  starts_at: z.string().datetime({ offset: true, message: "Pick a new time" }),
  note,
});

export const assignStaffSchema = z.object({
  booking_id: z.string().uuid(),
  // An empty choice means "unassign".
  staff_id: z
    .union([z.string().uuid(), z.literal("")])
    .transform((v) => v || null),
});

const phone = z
  .union([z.string().trim().regex(/^(\+63|0)9\d{9}$/, "Enter a PH mobile number"), z.literal("")])
  .optional();

export const staffBookingSchema = z
  .object({
    package_id: z.string().uuid("Choose a package"),
    starts_at: z.string().datetime({ offset: true, message: "Pick a time" }),
    customer_mode: z.enum(["existing", "new"]),
    customer_id: z.union([z.string().uuid(), z.literal("")]).optional(),
    customer_name: optionalText(100),
    customer_email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
    customer_phone: phone,
    addon_ids: z.array(z.string().uuid()).max(20).default([]),
    staff_id: z.union([z.string().uuid(), z.literal("")]).optional(),
    notes: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.customer_mode === "existing" && !value.customer_id) {
      ctx.addIssue({ code: "custom", path: ["customer_id"], message: "Choose a customer" });
    }
    if (value.customer_mode === "new" && (value.customer_name ?? "").length < 2) {
      ctx.addIssue({ code: "custom", path: ["customer_name"], message: "Enter the customer's name" });
    }
  });

/**
 * Money is entered as text and checked as text: pesos with at most two
 * decimals. Parsing first and checking `multipleOf(0.01)` would trip over
 * binary floating point (0.1 + 0.2).
 */
const pesos = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50")
  .transform(Number)
  .refine((n) => n > 0, "Enter an amount above zero");

export const paymentSchema = z
  .object({
    booking_id: z.string().uuid(),
    kind: z.enum(["payment", "refund"]),
    amount: pesos,
    method: z.enum(PAYMENT_METHODS),
    reference_no: optionalText(100),
    // datetime-local, in Manila time. Blank means "now".
    paid_at: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a date and time"), z.literal("")])
      .optional(),
    note: optionalText(300),
  })
  .transform(({ kind, amount, paid_at, ...rest }) => ({
    ...rest,
    // Refunds are negative entries in the same ledger.
    amount: kind === "refund" ? -amount : amount,
    paid_at: paid_at ? manilaDateTimeLocalToUtc(paid_at).toISOString() : undefined,
  }));

export const voidPaymentSchema = z.object({
  booking_id: z.string().uuid(),
  payment_id: z.string().uuid(),
  reason: z.string().trim().min(3, "Say why this payment is being voided").max(300),
});

export const bookingIdSchema = z.object({ booking_id: z.string().uuid() });

export const bookingListSchema = z.object({
  status: z.enum(["all", "pending", "approved", "completed", "cancelled", "rejected", "expired"]).catch("all"),
  when: z.enum(["upcoming", "past", "all"]).catch("upcoming"),
  q: z.string().trim().max(80).catch(""),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
