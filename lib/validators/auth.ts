import { z } from "zod";

/**
 * Password rules mirror the Supabase Auth settings pushed in config.toml
 * (minimum_password_length = 8, password_requirements =
 * "lower_upper_letters_digits"). Checking here too means the user sees a
 * specific field error instead of a generic API message.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .toLowerCase();

/** Philippine mobile number, as the legacy booking form required. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+63|0)9\d{9}$/, "Enter a PH mobile number, e.g. 09171234567");

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    email: emailSchema,
    phone: z.union([phoneSchema, z.literal("")]).optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    // The legacy signup only checked this box in the browser, so a direct POST
    // skipped it entirely.
    terms: z.literal("on", { message: "Please accept the terms to continue" }),
    // Consent to promotional email, separate from the terms and unticked by default.
    marketing: z.literal("on").optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const resendOtpSchema = z.object({ email: emailSchema });

export const requestPasswordResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
