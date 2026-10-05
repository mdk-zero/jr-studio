"use client";

import { useActionState } from "react";
import { signUpAction, type FormState } from "@/app/(auth)/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";

const initial: FormState = {};

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} ok={state.ok} />

      <Field label="Full name" name="fullName" errors={state.errors?.fullName}>
        <input id="fullName" name="fullName" autoComplete="name" required className={inputClass} />
      </Field>

      <Field label="Email" name="email" errors={state.errors?.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>

      <Field
        label="Mobile number"
        name="phone"
        errors={state.errors?.phone}
        hint="Optional. We use it only to reach you about a booking."
      >
        <input id="phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="09171234567" className={inputClass} />
      </Field>

      <Field
        label="Password"
        name="password"
        errors={state.errors?.password}
        hint="At least 8 characters, with upper and lower case letters and a number."
      >
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>

      <Field label="Confirm password" name="confirmPassword" errors={state.errors?.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="terms" className="flex items-start gap-2 text-sm text-muted">
          <input id="terms" name="terms" type="checkbox" className="mt-0.5 size-4 accent-burgundy-600" />
          <span>I agree to the studio&apos;s booking terms.</span>
        </label>
        {state.errors?.terms?.length ? (
          <p role="alert" className="text-xs font-medium text-red-700">{state.errors.terms[0]}</p>
        ) : null}
      </div>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
