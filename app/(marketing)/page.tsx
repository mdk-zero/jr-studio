import Link from "next/link";
import type { Metadata } from "next";
import { getActivePromotions, getCatalog, getPublicTestimonials } from "@/lib/catalog";
import { formatPeso } from "@/lib/money";
import { PackageCard } from "@/components/marketing/package-card";
import { PromoBand } from "@/components/marketing/promo-band";
import { TestimonialCard } from "@/components/marketing/testimonial-card";

export const metadata: Metadata = {
  title: "J&R Studio — Photography in Nasugbu, Batangas",
  description:
    "Studio sessions, prenup shoots, family portraits and event coverage in Nasugbu, Batangas. Browse packages and book online.",
};

const STEPS = [
  { title: "Pick a package", body: "Choose the session and any add-ons you want." },
  { title: "Choose a slot", body: "Live availability, so the time you pick is really free." },
  { title: "We confirm", body: "The studio approves your request and you get an email." },
  { title: "Come shoot", body: "Settle the balance on the day. We handle the rest." },
] as const;

export default async function HomePage() {
  const [catalog, promos, testimonials] = await Promise.all([
    getCatalog(),
    getActivePromotions(),
    getPublicTestimonials(3),
  ]);

  const packageCount = catalog.reduce((sum, c) => sum + c.packages.length, 0);
  const cheapest = Math.min(...catalog.flatMap((c) => c.packages.map((p) => Number(p.price))));

  return (
    <>
      {/* Hero: typography carries the page, with plates standing in for the
          photographs until the studio uploads its own. */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-20 sm:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="caps rise d1 text-burgundy-500">Nasugbu · Batangas</p>
            <h1 className="font-display rise d2 mt-5 text-5xl leading-[0.95] font-semibold text-burgundy-700 sm:text-6xl lg:text-7xl">
              Photographs
              <br />
              worth keeping
              <span className="text-burgundy-400">.</span>
            </h1>
            <p className="rise d3 mt-6 max-w-md text-base leading-relaxed text-muted">
              A small studio for portraits, prenups, milestones and events. Pick a
              package, choose a slot that is genuinely open, and we will take it
              from there.
            </p>

            <div className="rise d4 mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="#packages"
                className="caps rounded-full bg-burgundy-600 px-6 py-3 text-white transition hover:bg-burgundy-700"
              >
                See packages
              </Link>
              <Link
                href="/portfolio"
                className="caps text-burgundy-700 underline underline-offset-4 transition hover:text-burgundy-500"
              >
                View portfolio
              </Link>
            </div>

            <dl className="rise d5 mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-burgundy-600/15 pt-6">
              <div>
                <dt className="caps text-muted">Packages</dt>
                <dd className="font-display nums mt-1 text-2xl font-semibold text-ink">
                  {packageCount}
                </dd>
              </div>
              <div>
                <dt className="caps text-muted">From</dt>
                <dd className="font-display nums mt-1 text-2xl font-semibold text-ink">
                  {formatPeso(cheapest)}
                </dd>
              </div>
              <div>
                <dt className="caps text-muted">Booking</dt>
                <dd className="font-display mt-1 text-2xl font-semibold text-ink">Online</dd>
              </div>
            </dl>
          </div>

          {/* An index panel rather than placeholder photographs: it says what the
              studio shoots, and still looks deliberate once covers are uploaded. */}
          <aside className="rise d3 border-2 border-burgundy-700/80 bg-sand-100/60 p-8">
            <div className="flex items-baseline justify-between gap-4 border-b border-burgundy-600/20 pb-5">
              <span className="font-display text-5xl leading-none font-semibold text-burgundy-700">
                J&amp;R
              </span>
              <span className="caps text-right text-burgundy-500/70">
                Est. in
                <br />
                Nasugbu
              </span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {catalog.map((category) => (
                <li key={category.id} className="flex items-baseline justify-between gap-4">
                  <a
                    href="#packages"
                    className="text-sm text-ink transition hover:text-burgundy-600"
                  >
                    {category.name}
                  </a>
                  <span className="nums caps text-burgundy-500/60">
                    {String(category.packages.length).padStart(2, "0")}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <PromoBand promos={promos} />

      {/* Packages, grouped by category as a contact sheet. */}
      <section id="packages" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-burgundy-600/20 pb-6">
          <h2 className="font-display text-3xl font-semibold text-burgundy-700 sm:text-4xl">
            Packages
          </h2>
          <p className="max-w-sm text-sm text-muted">
            Every price below is what you pay; any active discount is already applied
            at checkout.
          </p>
        </header>

        <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2">
          {catalog.map((category) => (
            <a
              key={category.id}
              href={`#category-${category.slug}`}
              className="caps text-muted transition hover:text-burgundy-700"
            >
              {category.name}
            </a>
          ))}
        </div>

        <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.flatMap((category) =>
            category.packages.map((pkg, i) => (
              <div key={pkg.id} id={i === 0 ? `category-${category.slug}` : undefined} className="scroll-mt-28 h-full">
                <PackageCard pkg={pkg} categoryName={category.name} />
              </div>
            )),
          )}
        </div>
      </section>

      {/* How it works. Four steps that match what the system actually does. */}
      <section className="border-y border-burgundy-600/10 bg-sand-100">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold text-burgundy-700">How booking works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t border-burgundy-600/15 pt-4">
                <span className="caps nums text-burgundy-500/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-2 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {testimonials.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold text-burgundy-700">
            From the people we shot
          </h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="flex flex-wrap items-center justify-between gap-6 bg-burgundy-700 px-8 py-12 text-sand-100">
          <div>
            <h2 className="font-display text-3xl font-semibold">Ready when you are.</h2>
            <p className="mt-2 max-w-md text-sm text-sand-200/85">
              Create an account to book a slot and keep track of your sessions.
            </p>
          </div>
          <Link
            href="/signup"
            className="caps rounded-full bg-sand-100 px-6 py-3 text-burgundy-700 transition hover:bg-white"
          >
            Create an account
          </Link>
        </div>
      </section>
    </>
  );
}
