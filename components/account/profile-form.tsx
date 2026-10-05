"use client";

import { useActionState } from "react";
import { updateProfileAction, type AccountState } from "@/app/(account)/account/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";

const initial: AccountState = {};

export function ProfileForm({
  fullName,
  phone,
  address,
}: {
  fullName: string;
  phone: string;
  address: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-lg bg-burgundy-50 px-3 py-2 text-sm text-burgundy-700"
              : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Field label="Full name" name="full_name" errors={state.errors?.full_name}>
        <input id="full_name" name="full_name" defaultValue={fullName} required className={inputClass} />
      </Field>

      <Field label="Mobile number" name="phone" errors={state.errors?.phone}>
        <input id="phone" name="phone" defaultValue={phone} placeholder="09171234567" className={inputClass} />
      </Field>

      <Field label="Address" name="address" errors={state.errors?.address}>
        <input id="address" name="address" defaultValue={address} className={inputClass} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
