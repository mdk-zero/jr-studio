import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getActivePromotions,
  getCatalog,
  getPortfolio,
  getPublicTestimonials,
  storageUrl,
} from "@/lib/catalog";
import { formatPeso } from "@/lib/money";
import { PackageCard } from "@/components/marketing/package-card";
import { PromoBand } from "@/components/marketing/promo-band";
import { TestimonialCard } from "@/components/marketing/testimonial-card";
import { Timecode } from "@/components/marketing/timecode";

export const metadata: Metadata = {
  title: "J&R Studio — Photo & Video Studio in Nasugbu, Batangas",
  description:
    "Photo and video for studio sessions, prenups, family portraits and events in Nasugbu, Batangas. Browse packages and book online.",
};

const STEPS = [
  { title: "Pick a package", body: "Choose the session and any add-ons you want." },
  { title: "Choose a slot", body: "Live availability, so the time you pick is really free." },
  { title: "We confirm", body: "The studio approves your request and you get an email." },
  { title: "Come shoot", body: "Settle the balance on the day. We handle the rest." },
] as const;

const button =
  "caps press inline-flex items-center justify-center rounded-full px-6 py-3";

export default async function HomePage() {
  const [catalog, promos, testimonials, portfolio] = await Promise.all([
    getCatalog(),
    getActivePromotions(),
    getPublicTestimonials(3),
    getPortfolio(),
  ]);

  const packageCount = catalog.reduce((sum, c) => sum + c.packages.length, 0);
  const cheapest = Math.min(...catalog.flatMap((c) => c.packages.map((p) => Number(p.price))));

  // The studio's first portfolio photograph becomes the hero once it exists;
  // until then the frame shows the lit, empty backdrop.
  const heroPhoto = portfolio.albums.flatMap((a) => a.photos)[0] ?? portfolio.loose[0];
  const heroUrl = storageUrl("portfolio", heroPhoto?.storage_path);

  // One contact sheet across categories; the first frame of each category is
  // the anchor its film-strip link jumps to.
  const sheet = catalog.flatMap((category) =>
    category.packages.map((pkg, i) => ({ pkg, category, anchor: i === 0 })),
  );

  return (
    <>
      {/* Hero: the page as a camera's viewfinder, with the studio's real
          numbers where the exposure readout would be. */}
      <section className="backdrop relative isolate overflow-hidden border-b border-line">
        {heroUrl ? (
          <>
            <Image
              src={heroUrl}
              alt={heroPhoto?.title ?? "Recent work from J&R Studio"}
              fill
              sizes="100vw"
              preload
              className="-z-20 object-cover"
            />
            {/* Keeps the copy legible over any photograph. */}
            <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-canvas via-canvas/75 to-canvas/10" />
          </>
        ) : null}

        <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:py-8">
          <div className="relative flex min-h-[min(84svh,46rem)] flex-col justify-between px-4 py-5 sm:px-8 sm:py-7">
            <div aria-hidden className="viewfinder pointer-events-none absolute inset-0 text-ink [--vf-length:2rem]" />

            <div aria-hidden className="caps flex items-center justify-between gap-4 text-muted">
              <span className="flex items-center gap-2.5 text-ink">
                <span className="rec-dot" />
                Rec
                <Timecode className="text-muted" />
              </span>
              <span className="hidden sm:inline">Stills · Motion</span>
              <span>4K · 24p</span>
            </div>

            {/* Where the subject stands. It finds focus once the copy settles. */}
            <div
              aria-hidden
              className="acquire viewfinder pointer-events-none absolute top-[34%] right-[16%] hidden h-40 w-32 text-ink [--vf-length:0.875rem] lg:block"
            />

            <div className="max-w-2xl py-14">
              <p className="caps rise d1 text-brand">Photo &amp; video · Nasugbu, Batangas</p>
              <h1 className="rise d2 mt-5 text-5xl leading-[0.95] font-semibold text-heading sm:text-7xl lg:text-8xl">
                Stills &amp;{" "}
                <em className="font-normal text-brand">motion</em>,
                <br />
                made to keep.
              </h1>
              <p className="rise d3 mt-7 max-w-md text-base leading-relaxed text-muted">
                A small studio for portraits, prenups, milestones and events, in
                photographs and on video. Pick a package, choose a slot that is
                genuinely open, and we will take it from there.
              </p>

              <div className="rise d4 mt-9 flex flex-wrap items-center gap-3">
                <Link href="#packages" className={`${button} bg-action text-on-action hover:bg-action-hover`}>
                  See packages
                </Link>
                <Link
                  href="/portfolio"
                  className={`${button} border border-ink/25 text-ink hover:border-ink/60`}
                >
                  View portfolio
                </Link>
              </div>
            </div>

            <div className="rise d5 flex flex-wrap items-end justify-between gap-4 border-t border-ink/10 pt-4">
              <dl className="caps flex flex-wrap gap-x-8 gap-y-2 text-muted">
                <div className="flex gap-2">
                  <dt>Packages</dt>
                  <dd className="nums text-ink">{packageCount}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>From</dt>
                  <dd className="nums text-ink">{formatPeso(cheapest)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>Booking</dt>
                  <dd className="text-ink">Online</dd>
                </div>
              </dl>
              <p aria-hidden className="caps nums hidden text-faint md:block">
                f/2.8 · 1/125 · ISO 200
              </p>
            </div>
          </div>
        </div>
      </section>

      <PromoBand promos={promos} />

      {/* Packages: a contact sheet, with the categories as a strip of film. */}
      <section id="packages" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:py-24">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="caps text-brand">Packages</p>
            <h2 className="mt-3 text-4xl font-semibold text-heading sm:text-5xl">Choose your session</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Every price below is what you pay; any active discount is already applied
            at checkout.
          </p>
        </header>

        <nav
          aria-label="Package categories"
          className="sprockets -mx-5 mt-10 overflow-x-auto bg-night-900 sm:mx-0"
        >
          <ol className="flex snap-x gap-1.5 px-3">
            {catalog.map((category, i) => (
              <li key={category.id} className="min-w-28 flex-1 snap-start">
                <a
                  href={`#category-${category.slug}`}
                  className="group flex h-full flex-col justify-between gap-5 border border-line bg-canvas p-3 transition-colors duration-150 hover:border-brand/60"
                >
                  <span className="caps nums flex justify-between text-faint">
                    <span className="transition-colors group-hover:text-brand">
                      {String(i + 1).padStart(2, "0")}A
                    </span>
                    <span>{category.packages.length}</span>
                  </span>
                  <span className="text-sm leading-snug text-ink">{category.name}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheet.map(({ pkg, category, anchor }, i) => (
            <div
              key={pkg.id}
              id={anchor ? `category-${category.slug}` : undefined}
              className="h-full scroll-mt-28"
            >
              <PackageCard pkg={pkg} categoryName={category.name} frame={i + 1} />
            </div>
          ))}
        </div>
      </section>

      {/* How booking works, laid out as an edit timeline: four clips in order. */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
          <p className="caps text-brand">From booking to shoot</p>
          <h2 className="mt-3 text-4xl font-semibold text-heading">How booking works</h2>

          <div className="relative mt-12">
            <div aria-hidden className="ruler hidden h-6 lg:block" />
            <div aria-hidden className="absolute top-0 bottom-0 left-0 hidden w-px bg-rec lg:block">
              <span className="absolute -top-px -left-[5px] border-x-[5.5px] border-t-8 border-x-transparent border-t-rec" />
            </div>

            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-2 lg:grid-cols-4 lg:gap-1">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="border-t-2 border-brand/70 bg-raised px-5 pt-4 pb-6"
                >
                  <span className="caps nums text-muted">
                    V1 · {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {testimonials.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
          <p className="caps text-brand">Reviews</p>
          <h2 className="mt-3 text-4xl font-semibold text-heading">From the people we shot</h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <TestimonialCard
                key={t.id}
                message={t.message}
                rating={t.rating}
                authorName={t.author_name}
                packageName={t.packages?.name}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-5 pb-24">
        <div className="backdrop relative isolate overflow-hidden border border-line px-8 py-14 sm:px-14 sm:py-20">
          <div aria-hidden className="viewfinder pointer-events-none absolute inset-4 text-ink" />
          <p className="caps flex items-center gap-2.5 text-muted">
            <span aria-hidden className="size-2 rounded-full bg-brand" />
            Standing by
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-heading sm:text-5xl">Ready when you are.</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Create an account to book a slot and keep track of your sessions.
          </p>
          <Link
            href="/signup"
            className={`${button} mt-8 bg-action text-on-action hover:bg-action-hover`}
          >
            Create an account
          </Link>
        </div>
      </section>
    </>
  );
}
