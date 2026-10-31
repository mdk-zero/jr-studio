import type { Metadata } from "next";
import { getPortfolio } from "@/lib/catalog";
import { Plate } from "@/components/marketing/plate";
import { COVERS, FILM, SESSIONS } from "@/components/marketing/showcase";
import { StudioFilm } from "@/components/marketing/studio-film";
import { WorkGrid } from "@/components/marketing/work-grid";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Selected photo and video work from J&R Studio: weddings, portraits, families and events.",
};

/** Edge print under each frame on the contact sheet: 01A, 02A… */
function frameLabel(i: number) {
  return `${String(i + 1).padStart(2, "0")}A`;
}

export default async function PortfolioPage() {
  const { albums, loose } = await getPortfolio();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <header className="border-b border-line pb-8">
        <p className="caps text-brand">Selected work · Stills &amp; motion</p>
        <h1 className="mt-4 text-5xl font-semibold text-heading sm:text-6xl">Portfolio</h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
          Covers, portraits and family sessions shot in the studio, and a short film of
          the place itself.
        </p>
      </header>

      <div className="mt-14 space-y-20">
        {/* The studio's own selection, bundled with the site. Albums from the
            back office follow it. */}
        <section aria-labelledby="featured-heading">
          <SectionHead
            mark="Roll 00"
            label="Stills"
            title="Featured"
            id="featured-heading"
            count={COVERS.length + SESSIONS.length}
          />
          <WorkGrid items={[...COVERS, ...SESSIONS]} className="mt-6" />
        </section>

        <section aria-labelledby="motion-heading">
          <SectionHead mark="Reel 01" label="Motion" title="The studio film" id="motion-heading" />
          <div className="mt-6 max-w-4xl">
            <StudioFilm
              src={FILM.src}
              poster={FILM.poster}
              title={FILM.title}
              duration={FILM.duration}
              sizes="(min-width: 1024px) 896px, 100vw"
            />
          </div>
        </section>

        {albums.map((album, albumIndex) => (
          <section key={album.id}>
            <SectionHead
              mark={`Roll ${String(albumIndex + 1).padStart(2, "0")}`}
              label={album.categories?.name}
              title={album.title}
              description={album.description}
              count={album.photos.length}
            />

            {album.photos.length > 0 ? (
              <ContactSheet
                photos={album.photos}
                fallbackAlt={album.title}
              />
            ) : (
              // A quiet line beats a row of fabricated frames.
              <p className="caps mt-5 flex items-center gap-2.5 text-muted">
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                Still developing · photographs coming soon
              </p>
            )}
          </section>
        ))}

        {loose.length > 0 ? (
          <section>
            <h2 className="border-b border-line pb-4 text-3xl font-semibold text-heading">More work</h2>
            <ContactSheet photos={loose} fallbackAlt="Studio work" />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Frames laid out like a contact sheet, each with its edge number below. */
function ContactSheet({
  photos,
  fallbackAlt,
}: {
  photos: Array<{ id: string; title: string | null; storage_path: string }>;
  fallbackAlt: string;
}) {
  return (
    <ol className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, i) => (
        <li key={photo.id}>
          <Plate
            bucket="portfolio"
            path={photo.storage_path}
            alt={photo.title ?? fallbackAlt}
            className="aspect-square w-full"
            sizes="(min-width: 1024px) 25vw, 50vw"
          />
          <p className="caps nums mt-2 flex justify-between gap-2 text-faint">
            <span aria-hidden>{frameLabel(i)}</span>
            {photo.title ? <span className="truncate text-muted">{photo.title}</span> : null}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** A roll or reel's label line, title and frame count, over a hairline. */
function SectionHead({
  mark,
  label,
  title,
  id,
  description,
  count,
}: {
  mark: string;
  label?: string | null;
  title: string;
  id?: string;
  description?: string | null;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <p className="caps nums text-muted">
          {mark}
          {label ? <span className="text-brand"> · {label}</span> : null}
        </p>
        <h2 id={id} className="mt-2 text-3xl font-semibold text-heading">
          {title}
        </h2>
        {description ? <p className="mt-1.5 max-w-lg text-sm text-muted">{description}</p> : null}
      </div>
      {count ? (
        <p className="caps nums text-muted">
          {count} frame{count === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
