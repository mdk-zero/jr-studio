"use client";

import { useActionState } from "react";
import { unsubscribeAction, type UnsubscribeState } from "@/app/(marketing)/unsubscribe/actions";
import { buttonClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";

const initial: UnsubscribeState = {};

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeAction, initial);

  if (state.ok) {
    return <p role="status" className="text-sm leading-relaxed text-ink">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm leading-relaxed text-muted">
        Stop receiving news and offers from J&amp;R Studio? Emails about your own bookings still arrive.
      </p>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </button>
    </form>
  );
}
