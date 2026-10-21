"use client";

import { useActionState, useState } from "react";
import { Field, buttonClass, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { useFormMemory } from "@/components/forms/use-form-memory";

type State = { errors?: Record<string, string[]>; message?: string; ok?: boolean };
type Action = (state: State, formData: FormData) => Promise<State>;

/**
 * Star rating, review and display name. Used by the emailed review link (no
 * account) and by a signed-in customer's completed booking; only the action
 * and its hidden field differ.
 */
export function ReviewForm({
  action,
  hidden,
  defaultName,
}: {
  action: Action;
  hidden: Record<string, string>;
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const memory = useFormMemory(state);
  const [rating, setRating] = useState(0);

  if (state.ok) {
    return (
      <p role="status" className="rounded-lg bg-burgundy-50 px-4 py-6 text-center text-burgundy-700">
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={memory.onSubmit} action={formAction} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} ok={state.ok} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <fieldset>
        <legend className="text-sm font-medium text-ink">Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`text-3xl transition ${n <= rating ? "text-burgundy-600" : "text-sand-300 hover:text-burgundy-300"}`}
              >
                ★
              </span>
              <span className="sr-only">{n} star{n === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
        {state.errors?.rating?.length ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">{state.errors.rating[0]}</p>
        ) : null}
      </fieldset>

      <Field label="Your review" name="message" errors={state.errors?.message}>
        <textarea id="message" name="message" defaultValue={memory.text("message")} rows={5} maxLength={2000} required className={inputClass} />
      </Field>

      <Field
        label="Show my name as"
        name="author_name"
        errors={state.errors?.author_name}
        hint="As it will appear on the website, e.g. “Andrea S.”"
      >
        <input id="author_name" name="author_name" defaultValue={memory.text("author_name", defaultName)} maxLength={80} required className={inputClass} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Send review"}
      </button>
    </form>
  );
}
