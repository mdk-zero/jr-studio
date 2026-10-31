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
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

// Semantic tokens, so the same field reads correctly in the darkroom and on paper.
export const inputClass =
  "w-full rounded-sm border border-edge bg-surface px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/25 disabled:opacity-60";

export const buttonClass =
  "press inline-flex w-full items-center justify-center rounded-full bg-action px-4 py-3 " +
  "text-sm font-semibold text-on-action hover:bg-action-hover " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-60";
