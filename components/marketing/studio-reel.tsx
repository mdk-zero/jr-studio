"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's muted background loop. The poster still sits underneath (it is
 * the reel's first frame), so the video fades in over an identical image.
 *
 * The source is only attached once we know the visitor wants motion: nothing
 * downloads for reduced-motion or Save-Data visitors, who keep the still.
 * Playback also pauses while the hero is scrolled out of view.
 */
export function StudioReel({ src, className = "" }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || saveData) return;

    video.src = src;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      className={`transition-opacity duration-500 ease-out ${playing ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
