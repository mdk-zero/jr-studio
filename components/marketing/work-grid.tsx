import Image from "next/image";
import type { Work } from "@/components/marketing/showcase";

/**
 * Bundled studio work as a contact sheet: tall frames, each with its edge
 * number and the title (or kind of shoot) and issue date printed under it.
 */
export function WorkGrid({ items, className = "" }: { items: Work[]; className?: string }) {
  return (
    <ol className={`grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 ${className}`}>
      {items.map((work, i) => (
        <li key={work.image.src}>
          <figure>
            <div className="relative aspect-5/7 overflow-hidden bg-surface">
              <Image
                src={work.image}
                alt={work.alt}
                fill
                sizes="(min-width: 1152px) 270px, (min-width: 640px) 25vw, 50vw"
                placeholder="blur"
                className="object-cover"
              />
            </div>
            <figcaption className="caps nums mt-2.5 flex justify-between gap-2 text-muted">
              <span className="truncate">
                <span aria-hidden className="text-faint">
                  {String(i + 1).padStart(2, "0")}A{" "}
                </span>
                {work.title ?? work.kind}
              </span>
              {work.issue ? <span className="shrink-0">{work.issue}</span> : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ol>
  );
}
