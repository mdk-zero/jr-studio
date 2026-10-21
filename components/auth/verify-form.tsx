"use client";

import { useActionState } from "react";
import { resendOtpAction, verifyOtpAction, type FormState } from "@/app/(auth)/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: FormState = {};

export function VerifyForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyOtpAction, initial);
  const memory = useFormMemory(state);
  const [resendState, resendAction, resending] = useActionState(resendOtpAction, initial);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage message={state.message} ok={state.ok} />
        <input type="hidden" name="email" value={email} />

        <Field
          label="6-digit code"
          name="token"
          errors={state.errors?.token}
          hint="Check your inbox. The code expires in an hour."
        >
          <input
            id="token"
            name="token"
            defaultValue={memory.text("token")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className={`${inputClass} text-center text-lg tracking-[0.4em]`}
          />
        </Field>

        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <FormMessage message={resendState.message} ok={resendState.ok} />
        <button
          type="submit"
          disabled={resending}
          className="w-full text-xs font-medium text-burgundy-600 underline underline-offset-4 disabled:opacity-60"
        >
          {resending ? "Sending…" : "Send me a new code"}
        </button>
      </form>
    </div>
  );
}
