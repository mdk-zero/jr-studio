"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { postLoginPath } from "@/lib/auth/roles";
import {
  requestPasswordResetSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyOtpSchema,
} from "@/lib/validators/auth";

/** Shape returned to useActionState: field errors plus a form-level message. */
export type FormState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
};

function fieldErrors(error: z.ZodError): FormState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const { fullName, email, phone, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stored on auth.users and copied into profiles by the handle_new_user
      // trigger. Role is NOT passed: it is never taken from user input.
      data: { full_name: fullName, phone: phone || null },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    // Supabase returns the same response for an existing address when
    // confirmations are on, so there is nothing to leak here.
    return { message: error.message };
  }

  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyOtpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = verifyOtpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error || !data.user) {
    return { message: error?.message ?? "That code did not work. Request a new one." };
  }

  // Confirming the email fires the trigger that creates or claims the customer
  // record, so the role is readable now.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(postLoginPath(profile?.role ?? "customer"));
}

export async function resendOtpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resendOtpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) return { message: error.message };
  return { ok: true, message: "Sent. Check your inbox for a new code." };
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const { email, password, next } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately vague: saying which half was wrong tells an attacker which
    // addresses are registered.
    return { message: "Email or password is incorrect." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(postLoginPath(profile?.role ?? "customer", next));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestPasswordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });

  // Always the same answer, whether or not the address exists.
  return {
    ok: true,
    message: "If that email is registered, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();

  // Requires the recovery session established by /auth/confirm.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { message: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.claims.sub as string)
    .single();

  redirect(postLoginPath(profile?.role ?? "customer"));
}
