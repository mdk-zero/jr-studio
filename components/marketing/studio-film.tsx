"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";

/**
 * A film behind a poster. Nothing loads until the visitor presses play, then
 * the poster gives way to the real player with sound and controls. Keeps an
 * 18 MB file off every page view.
 */
export function StudioFilm({
  src,
  poster,
  title,
  duration,
  sizes = "(min-width: 1024px) 60vw, 100vw",
}: {
  src: string;
  poster: StaticImageData;
  title: string;
  duration: string;
  sizes?: string;
}) {
  const [started, setStarted] = useState(false);

  return (
    <div className="darkroom viewfinder relative aspect-video overflow-hidden [--vf-inset:0.75rem] [--vf-length:1.5rem]">
      {started ? (
        // A film the visitor asked for: sound on, their controls.
        <video
          src={src}
          autoPlay
          controls
          playsInline
          className="absolute inset-0 size-full bg-night-950"
          aria-label={title}
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label={`Play ${title}, ${duration}, with sound`}
          className="group absolute inset-0 cursor-pointer text-left focus-visible:outline-none"
        >
          <Image src={poster} alt="" fill sizes={sizes} placeholder="blur" className="object-cover" />
          <span aria-hidden className="absolute inset-0 bg-night-950/45 transition-colors duration-200 group-hover:bg-night-950/30" />

          <span aria-hidden className="caps absolute top-6 left-7 flex items-center gap-2.5 text-bone">
            <svg aria-hidden viewBox="0 0 10 10" className="size-2 fill-current">
              <path d="M1 0.5 9.5 5 1 9.5Z" />
            </svg>
            Play
          </span>
          <span aria-hidden className="caps nums absolute top-6 right-7 text-bone/80">{duration}</span>

          <span aria-hidden className="absolute top-1/2 left-1/2 flex size-18 -translate-1/2 items-center justify-center rounded-full bg-bone/95 text-night-950 shadow-lg transition-[scale,background-color] duration-150 ease-out group-hover:bg-white group-focus-visible:ring-4 group-focus-visible:ring-bone/50 group-active:scale-[0.97]">
            <svg aria-hidden viewBox="0 0 24 24" className="ml-1 size-7 fill-current">
              <path d="M7 4.5v15l12.5-7.5Z" />
            </svg>
          </span>

          <span aria-hidden className="absolute right-7 bottom-6 left-7 font-display text-2xl font-semibold text-bone sm:text-3xl">
            {title}
          </span>
        </button>
      )}
    </div>
  );
}
