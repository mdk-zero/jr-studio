"use client";

import { useActionState } from "react";
import { updateProfileAction, type AccountState } from "@/app/(account)/account/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: AccountState = {};

export function ProfileForm({
  fullName,
  phone,
  address,
  marketingOptIn,
}: {
  fullName: string;
  phone: string;
  address: string;
  marketingOptIn: boolean;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  const memory = useFormMemory(state);

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-sm bg-tint px-3 py-2 text-sm text-on-tint"
              : "rounded-sm bg-danger-tint px-3 py-2 text-sm text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Field label="Full name" name="full_name" errors={state.errors?.full_name}>
        <input id="full_name" name="full_name" defaultValue={memory.text("full_name", fullName)} required className={inputClass} />
      </Field>

      <Field label="Mobile number" name="phone" errors={state.errors?.phone}>
        <input id="phone" name="phone" defaultValue={memory.text("phone", phone)} placeholder="09171234567" className={inputClass} />
      </Field>

      <Field label="Address" name="address" errors={state.errors?.address}>
        <input id="address" name="address" defaultValue={memory.text("address", address)} className={inputClass} />
      </Field>

      <label htmlFor="marketing_opt_in" className="flex items-start gap-2 text-sm text-muted">
        <input
          id="marketing_opt_in"
          name="marketing_opt_in"
          type="checkbox"
          defaultChecked={memory.checked("marketing_opt_in", marketingOptIn)}
          className="mt-0.5 size-4 accent-brand"
        />
        <span>Email me studio news and offers. Booking emails are sent either way.</span>
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
