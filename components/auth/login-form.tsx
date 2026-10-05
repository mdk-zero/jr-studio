"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "@/app/(auth)/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";

const initial: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} ok={state.ok} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email" name="email" errors={state.errors?.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>

      <Field label="Password" name="password" errors={state.errors?.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
