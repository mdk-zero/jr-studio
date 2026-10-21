"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "@/app/(auth)/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  const memory = useFormMemory(state);

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} ok={state.ok} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email" name="email" errors={state.errors?.email}>
        <input id="email" name="email" defaultValue={memory.text("email")} type="email" autoComplete="email" required className={inputClass} />
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
