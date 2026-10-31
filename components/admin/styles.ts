/**
 * Shared class strings for admin forms, in semantic tokens so they follow the
 * visitor's light or dark theme. Deliberately not a client module, so
 * Server Components (list pages with GET filter forms) and Client Components
 * can both import them as plain strings.
 */
export const adminInput =
  "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-faint focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/25";

export const adminButton =
  "press inline-flex items-center justify-center rounded-lg bg-action px-4 py-2 text-sm " +
  "font-semibold text-on-action hover:bg-action-hover focus:outline-none " +
  "focus:ring-2 focus:ring-brand/40 disabled:opacity-60";

export const adminButtonQuiet =
  "press inline-flex items-center justify-center rounded-lg border border-edge bg-surface px-3 py-1.5 " +
  "text-xs font-medium text-ink hover:bg-raised disabled:opacity-60";
