"use client";

import { useFormStatus } from "react-dom";

export const adminInput =
  "w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-ink " +
  "placeholder:text-sand-400 focus:border-burgundy-500 focus:outline-none " +
  "focus:ring-2 focus:ring-burgundy-500/20";

export const adminButton =
  "inline-flex items-center justify-center rounded-lg bg-burgundy-600 px-4 py-2 text-sm " +
  "font-semibold text-white transition hover:bg-burgundy-700 focus:outline-none " +
  "focus:ring-2 focus:ring-burgundy-500/40 disabled:opacity-60";

export const adminButtonQuiet =
  "inline-flex items-center justify-center rounded-lg border border-sand-300 bg-white px-3 py-1.5 " +
  "text-xs font-medium text-ink transition hover:bg-sand-100 disabled:opacity-60";

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  quiet = false,
  className = "",
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  quiet?: boolean;
  className?: string;
  confirm?: string;
  /** Lets one form offer several actions: the pressed button's value is submitted. */
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons, only the one that was pressed shows progress.
  const isThisOne = pending && (!name || data?.get(name) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${quiet ? adminButtonQuiet : adminButton} ${className}`}
      onClick={
        confirm
          ? (event) => {
              // Destructive actions ask first. The legacy portfolio page deleted
              // on a single click, sometimes twice over.
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
    >
      {isThisOne ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
