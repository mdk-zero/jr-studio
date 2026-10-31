"use client";

import { useEffect, useRef } from "react";

const FPS = 24;

function format(frames: number): string {
  const seconds = Math.floor(frames / FPS);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, frames % FPS]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/**
 * A running timecode (HH:MM:SS:FF at 24 fps) for the hero's REC readout.
 * Written straight to the DOM from requestAnimationFrame so React does not
 * re-render 24 times a second, and rAF already pauses in a background tab.
 * Holds at zero for visitors who prefer reduced motion. Decorative, so hidden
 * from screen readers.
 */
export function Timecode({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = performance.now();
    let shown = 0;
    let raf = requestAnimationFrame(function tick(now) {
      const frames = Math.floor(((now - start) / 1000) * FPS);
      if (frames !== shown && ref.current) {
        shown = frames;
        ref.current.textContent = format(frames);
      }
      raf = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span ref={ref} aria-hidden className={`nums ${className}`}>
      {format(0)}
    </span>
  );
}
