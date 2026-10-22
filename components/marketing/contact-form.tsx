"use client";

import { useActionState } from "react";
import { submitContactAction, type ContactState } from "@/app/(marketing)/contact/actions";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: ContactState = {};

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactAction, initial);
  const memory = useFormMemory(state);

  if (state.ok) {
    return (
      <p role="status" className="rounded-lg bg-burgundy-50 px-4 py-6 text-center text-burgundy-700">
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} ok={state.ok} />

      <Field label="Your name" name="name" errors={state.errors?.name}>
        <input id="name" name="name" defaultValue={memory.text("name")} autoComplete="name" required className={inputClass} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" name="email" errors={state.errors?.email}>
          <input id="email" name="email" defaultValue={memory.text("email")} type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Mobile (optional)" name="phone" errors={state.errors?.phone}>
          <input id="phone" name="phone" defaultValue={memory.text("phone")} inputMode="tel" autoComplete="tel" placeholder="09171234567" className={inputClass} />
        </Field>
      </div>

      <Field label="Message" name="message" errors={state.errors?.message} hint="The date you have in mind, how many people, and the kind of shoot help us reply faster.">
        <textarea id="message" name="message" defaultValue={memory.text("message")} rows={6} required maxLength={3000} className={inputClass} />
      </Field>

      {/* Hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
