"use client";

import { useId, useSyncExternalStore } from "react";
import { THEME_KEY, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function current(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed it: follow along.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) setTheme(event.newValue === "light" || event.newValue === "dark" ? event.newValue : "system", false);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setTheme(theme: Theme, persist = true) {
  // Suspend transitions for a frame, so the page switches at once instead of
  // every hover colour fading separately.
  const pause = document.createElement("style");
  pause.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(pause);

  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;

  if (persist) {
    try {
      if (theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private mode or storage blocked: the choice lasts for this page only.
    }
  }

  void getComputedStyle(root).colorScheme; // apply the new scheme before re-enabling transitions
  requestAnimationFrame(() => requestAnimationFrame(() => pause.remove()));
  listeners.forEach((listener) => listener());
}

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1" />
        <path d="M5.5 14h5M8 11.25V14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
      </svg>
    ),
  },
];

/**
 * Light / System / Dark. Native radios underneath, so arrow keys move the
 * choice and screen readers announce a group. The choice is per device
 * (localStorage) and applies to the whole site, back office included.
 *
 * Nothing is selected in the server render: only the browser knows the stored
 * choice, and it fills in straight after hydration.
 */
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, () => null);
  const name = useId();

  return (
    <fieldset className={`inline-flex rounded-full border border-line p-0.5 ${className}`}>
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          title={option.label}
          className={`flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-brand/50 ${
            theme === option.value ? "bg-raised text-ink ring-1 ring-edge/70" : "text-muted hover:text-ink"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={theme === option.value}
            onChange={() => setTheme(option.value)}
            className="sr-only"
          />
          {option.icon}
          <span className="sr-only">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
