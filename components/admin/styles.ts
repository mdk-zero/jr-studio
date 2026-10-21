/**
 * Shared class strings for admin forms. Deliberately not a client module, so
 * Server Components (list pages with GET filter forms) and Client Components
 * can both import them as plain strings.
 */
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
