import type { ReactNode } from "react";

export function Field({
  label,
  name,
  errors,
  hint,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  hint?: ReactNode;
  children: ReactNode;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {errors?.length ? (
        // aria-live so a validation error is announced, not just recoloured.
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-ink " +
  "placeholder:text-sand-400 focus:border-burgundy-500 focus:outline-none " +
  "focus:ring-2 focus:ring-burgundy-500/20 disabled:opacity-60";

export const buttonClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-burgundy-600 px-4 py-2.5 " +
  "text-sm font-semibold text-white transition hover:bg-burgundy-700 " +
  "focus:outline-none focus:ring-2 focus:ring-burgundy-500/40 disabled:opacity-60";
