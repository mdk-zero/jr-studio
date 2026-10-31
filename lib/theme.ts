/**
 * The visitor's colour theme. "system" follows the device; the other two
 * override it. Shared by the switcher (client) and the root layout's inline
 * script (server), so it must stay a plain module.
 */
export type Theme = "light" | "system" | "dark";

/** localStorage key holding "light" or "dark"; absent means "system". */
export const THEME_KEY = "jr-theme";
