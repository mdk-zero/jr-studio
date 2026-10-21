"use client";

import { useState, type FormEvent } from "react";

type Values = Record<string, string[]>;

/**
 * Keeps what someone typed when a submission comes back unsuccessful.
 *
 * React 19 resets an uncontrolled form after every action submission, a
 * failed validation included, so a typo in one field used to wipe every other
 * field. This records the submitted values on submit and, until a successful
 * result, offers them as the inputs' defaults. React's reset then restores
 * the user's input instead of blanking it. After a success the defaults fall
 * back to the props, which by then hold the freshly saved data.
 *
 * Passwords are never kept.
 */
export function useFormMemory(state: { ok?: boolean }) {
  const [values, setValues] = useState<Values | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const next: Values = {};
    for (const key of new Set(data.keys())) {
      if (key.startsWith("$ACTION") || /password/i.test(key)) continue;
      next[key] = data.getAll(key).filter((v): v is string => typeof v === "string");
    }
    setValues(next);
  }

  const kept = state.ok ? null : values;

  return {
    onSubmit,
    /** For text inputs, textareas and selects. */
    text(name: string, fallback?: string | number | null): string {
      if (kept) return kept[name]?.[0] ?? "";
      return fallback == null ? "" : String(fallback);
    },
    /** For a single checkbox. Unticked boxes are absent from a submission. */
    checked(name: string, fallback: boolean): boolean {
      return kept ? (kept[name] ?? []).length > 0 : fallback;
    },
    /** For one checkbox in a group sharing a name (e.g. add-on ids). */
    includes(name: string, value: string, fallback: boolean): boolean {
      return kept ? (kept[name] ?? []).includes(value) : fallback;
    },
  };
}
