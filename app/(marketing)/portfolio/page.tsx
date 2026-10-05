import type { Metadata } from "next";
import { getPortfolio } from "@/lib/catalog";
import { Plate } from "@/components/marketing/plate";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Selected work from J&R Studio: weddings, portraits, families and events.",
};

export default async function PortfolioPage() {
  const { albums, loose } = await getPortfolio();
  const hasPhotos = albums.some((a) => a.photos.length > 0) || loose.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14">
      <header className="border-b border-burgundy-600/20 pb-6">
        <p className="caps text-burgundy-500">Selected work</p>
        <h1 className="font-display mt-4 text-4xl font-semibold text-burgundy-700 sm:text-5xl">
          Portfolio
        </h1>
      </header>

      {!hasPhotos ? (
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted">
          Albums are set up and photographs are being added. In the meantime, the
          packages page shows what each kind of session includes.
        </p>
      ) : null}

      <div className="mt-14 space-y-20">
        {albums.map((album, albumIndex) => (
          <section key={album.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-burgundy-600/15 pb-4">
              <div className="flex items-baseline gap-4">
                <span className="caps nums text-burgundy-500/60">
                  {String(albumIndex + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-ink">{album.title}</h2>
                  {album.description ? (
                    <p className="mt-1 max-w-lg text-sm text-muted">{album.description}</p>
                  ) : null}
                </div>
              </div>
              <p className="caps nums text-muted">
                {album.photos.length
                  ? `${album.photos.length} photo${album.photos.length === 1 ? "" : "s"}`
                  : album.categories?.name ?? "Coming soon"}
              </p>
            </div>

            {album.photos.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {album.photos.map((photo) => (
                  <Plate
                    key={photo.id}
                    bucket="portfolio"
                    path={photo.storage_path}
                    alt={photo.title ?? album.title}
                    className="aspect-square w-full"
                    sizes="(min-width: 1024px) 25vw, 50vw"
                  />
                ))}
              </div>
            ) : (
              // A quiet line beats a row of fabricated frames.
              <p className="caps mt-5 text-burgundy-500/60">Photographs coming soon</p>
            )}
          </section>
        ))}

        {loose.length > 0 ? (
          <section>
            <h2 className="font-display border-b border-burgundy-600/15 pb-4 text-2xl font-semibold text-ink">
              More work
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {loose.map((photo) => (
                <Plate
                  key={photo.id}
                  bucket="portfolio"
                  path={photo.storage_path}
                  alt={photo.title ?? "Studio work"}
                  className="aspect-square w-full"
                  sizes="(min-width: 1024px) 25vw, 50vw"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
