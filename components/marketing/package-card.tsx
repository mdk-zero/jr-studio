import Link from "next/link";
import type { PackageCard as PackageCardData } from "@/lib/catalog";
import { formatDuration } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { storageUrl } from "@/lib/catalog";
import { Plate } from "@/components/marketing/plate";

/**
 * Typography-first by design. A cover photo is shown when one exists, but the
 * card is not built around it: with an empty catalogue of images, a grid of
 * placeholder boxes reads as broken rather than minimal.
 */
export function PackageCard({
  pkg,
  categoryName,
}: {
  pkg: PackageCardData;
  categoryName?: string;
}) {
  const hasCover = Boolean(storageUrl("packages", pkg.cover_path));

  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="group flex h-full flex-col border-t-2 border-burgundy-700/80 pt-4 transition hover:border-burgundy-500"
    >
      {categoryName ? <span className="caps text-burgundy-500/70">{categoryName}</span> : null}

      <h3 className="font-display mt-2 text-xl leading-snug font-semibold text-burgundy-700 transition group-hover:text-burgundy-500">
        {pkg.name}
      </h3>

      {hasCover ? (
        <Plate
          bucket="packages"
          path={pkg.cover_path}
          alt={pkg.name}
          className="mt-4 aspect-3/2 w-full"
          sizes="(min-width: 1024px) 30vw, 100vw"
        />
      ) : null}

      {pkg.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{pkg.description}</p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <p className="font-display nums text-2xl leading-none font-semibold text-ink">
          {formatPeso(pkg.price)}
        </p>
        <p className="caps nums text-right text-muted">
          {formatDuration(pkg.duration_minutes)}
          {pkg.photos_included ? (
            <>
              <br />
              <span className="text-burgundy-500/70">{pkg.photos_included}</span>
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
