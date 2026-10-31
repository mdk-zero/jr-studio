import type { Metadata } from "next";
import { getPortfolio } from "@/lib/catalog";
import { Plate } from "@/components/marketing/plate";

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
  const hasPhotos = albums.some((a) => a.photos.length > 0) || loose.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <header className="border-b border-line pb-8">
        <p className="caps text-brand">Selected work · Stills &amp; motion</p>
        <h1 className="mt-4 text-5xl font-semibold text-heading sm:text-6xl">Portfolio</h1>
        {!hasPhotos ? (
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
            Albums are set up and photographs are being added. In the meantime, the
            packages page shows what each kind of session includes.
          </p>
        ) : null}
      </header>

      <div className="mt-14 space-y-20">
        {albums.map((album, albumIndex) => (
          <section key={album.id}>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="caps nums text-muted">
                  Roll {String(albumIndex + 1).padStart(2, "0")}
                  {album.categories?.name ? (
                    <span className="text-brand"> · {album.categories.name}</span>
                  ) : null}
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-heading">{album.title}</h2>
                {album.description ? (
                  <p className="mt-1.5 max-w-lg text-sm text-muted">{album.description}</p>
                ) : null}
              </div>
              {album.photos.length ? (
                <p className="caps nums text-muted">
                  {album.photos.length} frame{album.photos.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>

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
