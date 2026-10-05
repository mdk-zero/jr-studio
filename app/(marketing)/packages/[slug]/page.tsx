import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPackageDetail, getPackageSlugs, storageUrl } from "@/lib/catalog";
import { formatDuration } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { Plate } from "@/components/marketing/plate";

export async function generateStaticParams() {
  const slugs = await getPackageSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/packages/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const pkg = await getPackageDetail(slug);
  if (!pkg) return { title: "Package not found" };

  return {
    title: pkg.name,
    description:
      pkg.description ??
      `${pkg.name} — ${formatDuration(pkg.duration_minutes)} session at J&R Studio.`,
  };
}

export default async function PackagePage(props: PageProps<"/packages/[slug]">) {
  const { slug } = await props.params;
  const pkg = await getPackageDetail(slug);

  if (!pkg || !pkg.is_active) notFound();

  const { quote } = pkg;
  const hasCover = Boolean(storageUrl("packages", pkg.cover_path));
  const hasDiscount = quote.discount_amount > 0;

  const specs = [
    { label: "Duration", value: formatDuration(pkg.duration_minutes) },
    pkg.photos_included ? { label: "Photos", value: pkg.photos_included } : null,
    pkg.outfits ? { label: "Outfits", value: String(pkg.outfits) } : null,
    pkg.backdrops ? { label: "Backdrops", value: String(pkg.backdrops) } : null,
    pkg.digital_images ? { label: "Digital copies", value: "Included" } : null,
    pkg.magazine_cover ? { label: "Magazine cover", value: "Included" } : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  return (
    <article className="mx-auto w-full max-w-6xl px-5 py-14">
      <nav className="caps text-muted">
        <Link href="/" className="hover:text-burgundy-700">
          Home
        </Link>
        <span className="mx-2 text-burgundy-600/30">/</span>
        <Link href="/#packages" className="hover:text-burgundy-700">
          Packages
        </Link>
        {pkg.category ? (
          <>
            <span className="mx-2 text-burgundy-600/30">/</span>
            <span className="text-burgundy-600">{pkg.category.name}</span>
          </>
        ) : null}
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div>
          <h1 className="font-display text-4xl leading-tight font-semibold text-burgundy-700 sm:text-5xl">
            {pkg.name}
          </h1>
          {pkg.description ? (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{pkg.description}</p>
          ) : null}

          {/* Only shown once a cover exists; an empty frame this large reads as
              a broken image rather than a deliberate blank. */}
          {hasCover ? (
            <Plate
              bucket="packages"
              path={pkg.cover_path}
              alt={pkg.name}
              className="mt-10 aspect-16/10 w-full"
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
            />
          ) : null}

          {pkg.images.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {pkg.images.map((image) => (
                <Plate
                  key={image.storage_path}
                  bucket="packages"
                  path={image.storage_path}
                  alt={image.alt ?? pkg.name}
                  className="aspect-square w-full"
                  sizes="(min-width: 1024px) 20vw, 33vw"
                />
              ))}
            </div>
          ) : null}

          <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-burgundy-600/15 pt-6 sm:grid-cols-3">
            {specs.map((spec) => (
              <div key={spec.label}>
                <dt className="caps text-muted">{spec.label}</dt>
                <dd className="font-display nums mt-1 text-lg font-semibold text-ink">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>

          {pkg.inclusions.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-burgundy-700">
                What is included
              </h2>
              <ol className="mt-5 space-y-3">
                {pkg.inclusions.map((item, i) => (
                  <li key={item} className="flex gap-4 border-t border-burgundy-600/10 pt-3">
                    <span className="caps nums text-burgundy-500/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-ink">{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        {/* Price card. The figures come from quote_booking, the same function the
            booking flow uses, so this page cannot disagree with checkout. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-burgundy-600/15 bg-white p-7">
            {hasDiscount ? (
              <div className="flex items-center gap-3">
                <span className="caps rounded-full bg-burgundy-700 px-3 py-1 text-sand-100">
                  {quote.discount_percent}% off
                </span>
                <span className="nums text-sm text-muted line-through">
                  {formatPeso(quote.package_price)}
                </span>
              </div>
            ) : null}

            <p className="font-display nums mt-3 text-4xl font-semibold text-ink">
              {formatPeso(quote.total_amount)}
            </p>
            <p className="caps mt-2 text-muted">
              {formatDuration(pkg.duration_minutes)} session
            </p>

            <Link
              href={`/book?package=${pkg.slug}`}
              className="caps mt-7 block rounded-full bg-burgundy-600 px-6 py-3.5 text-center text-white transition hover:bg-burgundy-700"
            >
              Book this package
            </Link>
            <p className="mt-3 text-center text-xs text-muted">
              No payment online. The studio confirms your slot first.
            </p>

            {pkg.addons.length > 0 ? (
              <div className="mt-8 border-t border-burgundy-600/15 pt-6">
                <h2 className="caps text-burgundy-500">Add-ons available</h2>
                <ul className="mt-4 space-y-3">
                  {pkg.addons.map((addon) => (
                    <li key={addon.id} className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-ink">{addon.name}</span>
                      <span className="nums text-sm whitespace-nowrap text-muted">
                        + {formatPeso(addon.price)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">
                  Pick any of these while booking; discounts apply to the total.
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </article>
  );
}
