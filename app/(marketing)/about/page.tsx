import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getAboutTeam, getStudioSettings } from "@/lib/catalog";
import { POSITION_LABEL } from "@/lib/people-labels";
import { Plate } from "@/components/marketing/plate";
import { FILM, SPACE } from "@/components/marketing/showcase";
import { StudioFilm } from "@/components/marketing/studio-film";

export const metadata: Metadata = {
  title: "About",
  description: "The people behind J&R Studio, a photo and video studio in Nasugbu, Batangas.",
};

export default async function AboutPage() {
  const [team, settings] = await Promise.all([getAboutTeam(), getStudioSettings()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <header className="border-b border-line pb-10">
        <p className="caps text-brand">Capture · Create · Celebrate</p>
        <h1 className="mt-4 text-5xl font-semibold text-heading sm:text-6xl">
          About {settings.studio_name}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          A small photo and video studio in Nasugbu, Batangas. We shoot portraits, prenups, families,
          milestones and events, in the studio and on location, and we keep the booking simple: choose a
          package, pick a time that is really free, and we confirm it.
        </p>
      </header>

      {/* The space, from the studio's own film. */}
      <section aria-labelledby="space-heading" className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="space-heading" className="caps text-brand">
            The studio
          </h2>
          <p className="caps nums text-muted">Reel 01 · {FILM.duration}</p>
        </div>
        <div className="mt-6">
          <StudioFilm
            src={FILM.src}
            poster={FILM.poster}
            title={FILM.title}
            duration={FILM.duration}
            sizes="(min-width: 1152px) 1104px, 100vw"
          />
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {SPACE.map((still, i) => (
            // Four fill the narrower rows evenly; the fifth joins at full width.
            <li key={still.label} className={i === SPACE.length - 1 ? "hidden lg:block" : undefined}>
              <figure>
                <div className="relative aspect-video overflow-hidden bg-surface">
                  <Image
                    src={still.image}
                    alt={still.alt}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                    placeholder="blur"
                    className="object-cover"
                  />
                </div>
                <figcaption className="caps mt-2 text-muted">{still.label}</figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </section>

      {team.length > 0 ? (
        <section className="mt-20">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="caps text-brand">The crew</h2>
            <p className="caps nums text-muted">{team.length} on set</p>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((person) => (
              <li key={person.id}>
                <Plate
                  bucket="staff"
                  path={person.photo_path}
                  alt={person.full_name}
                  caption="Portrait coming soon"
                  className="aspect-4/5 w-full"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
                <p className="mt-5 font-display text-2xl font-semibold text-heading">{person.full_name}</p>
                <p className="caps mt-1.5 text-brand">{POSITION_LABEL[person.position]}</p>
                {person.bio ? <p className="mt-2 text-sm leading-relaxed text-muted">{person.bio}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-20 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-10">
        <p className="max-w-md font-display text-3xl font-semibold text-heading">Have a shoot in mind?</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/#packages"
            className="caps press inline-flex rounded-full bg-action px-6 py-3 text-on-action hover:bg-action-hover"
          >
            See packages
          </Link>
          <Link
            href="/contact"
            className="caps press inline-flex rounded-full border border-ink/25 px-6 py-3 text-ink hover:border-ink/60"
          >
            Ask a question
          </Link>
        </div>
      </section>
    </div>
  );
}
