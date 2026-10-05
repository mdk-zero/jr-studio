"use client";

import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "@/app/(auth)/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";

const initial: FormState = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} ok={state.ok} />

      <Field
        label="New password"
        name="password"
        errors={state.errors?.password}
        hint="At least 8 characters, with upper and lower case letters and a number."
      >
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>

      <Field label="Confirm new password" name="confirmPassword" errors={state.errors?.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
