import Link from "next/link";
import type { Metadata } from "next";
import { getAboutTeam, getStudioSettings } from "@/lib/catalog";
import { POSITION_LABEL } from "@/lib/people-labels";
import { Plate } from "@/components/marketing/plate";

export const metadata: Metadata = {
  title: "About",
  description: "The people behind J&R Studio, a photography studio in Nasugbu, Batangas.",
};

export default async function AboutPage() {
  const [team, settings] = await Promise.all([getAboutTeam(), getStudioSettings()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <header className="border-b border-burgundy-600/20 pb-6">
        <p className="caps text-burgundy-500">Capture · Create · Celebrate</p>
        <h1 className="font-display mt-4 text-4xl font-semibold text-burgundy-700 sm:text-5xl">
          About {settings.studio_name}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          A small photography studio in Nasugbu, Batangas. We shoot portraits, prenups, families, milestones
          and events, in the studio and on location, and we keep the booking simple: choose a package, pick a
          time that is really free, and we confirm it.
        </p>
      </header>

      {team.length > 0 ? (
        <section className="mt-14">
          <h2 className="caps text-burgundy-500">The team</h2>
          <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((person) => (
              <li key={person.id}>
                <Plate
                  bucket="staff"
                  path={person.photo_path}
                  alt={person.full_name}
                  caption={person.full_name}
                  className="aspect-[4/5] w-full"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
                <p className="font-display mt-4 text-xl font-semibold text-ink">{person.full_name}</p>
                <p className="caps mt-1 text-burgundy-500">{POSITION_LABEL[person.position]}</p>
                {person.bio ? <p className="mt-2 text-sm leading-relaxed text-muted">{person.bio}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-burgundy-600/15 pt-10">
        <p className="font-display max-w-md text-2xl font-semibold text-ink">Have a shoot in mind?</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/#packages" className="caps rounded-full bg-burgundy-600 px-6 py-3 text-white transition hover:bg-burgundy-700">
            See packages
          </Link>
          <Link href="/contact" className="caps self-center text-burgundy-700 underline underline-offset-4 hover:text-burgundy-500">
            Ask a question
          </Link>
        </div>
      </section>
    </div>
  );
}
