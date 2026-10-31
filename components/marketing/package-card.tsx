import Link from "next/link";
import type { PackageCard as PackageCardData } from "@/lib/catalog";
import { formatDuration } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { storageUrl } from "@/lib/catalog";
import { Plate } from "@/components/marketing/plate";

/**
 * One frame on the contact sheet. Typography carries it; a cover photo is
 * shown when one exists, but the card is not built around it. On hover the
 * viewfinder brackets close in, like autofocus locking onto the choice.
 */
export function PackageCard({
  pkg,
  categoryName,
  frame,
}: {
  pkg: PackageCardData;
  categoryName?: string;
  frame?: number;
}) {
  const hasCover = Boolean(storageUrl("packages", pkg.cover_path));

  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="viewfinder focus-lock group flex h-full flex-col border border-line bg-surface p-5 transition-colors duration-150 [--vf-color:var(--color-brand)] [--vf-inset:-7px] hover:border-edge focus-visible:border-brand focus-visible:outline-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        {categoryName ? <span className="caps text-brand">{categoryName}</span> : <span />}
        {frame ? (
          <span aria-hidden className="caps nums text-faint">
            Fr {String(frame).padStart(2, "0")}
          </span>
        ) : null}
      </div>

      {hasCover ? (
        <Plate
          bucket="packages"
          path={pkg.cover_path}
          alt={pkg.name}
          className="mt-4 aspect-3/2 w-full"
          sizes="(min-width: 1024px) 30vw, 100vw"
        />
      ) : null}

      <h3 className="mt-5 text-2xl leading-snug font-semibold text-heading">{pkg.name}</h3>

      {pkg.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{pkg.description}</p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <p className="font-display nums text-2xl leading-none font-semibold text-ink">
          {formatPeso(pkg.price)}
        </p>
        <p className="caps nums text-right leading-relaxed text-muted">
          {formatDuration(pkg.duration_minutes)}
          {pkg.photos_included ? (
            <>
              <br />
              {pkg.photos_included}
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
