import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getPortfolioAdmin } from "@/lib/admin-content";
import { storageUrl } from "@/lib/catalog";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-button";
import { AlbumForm } from "@/components/admin/portfolio/album-form";
import { PhotoCard } from "@/components/admin/portfolio/photo-card";
import { PhotoUploader } from "@/components/admin/portfolio/photo-uploader";
import { deleteAlbumAction } from "@/app/admin/portfolio/actions";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioAdminPage() {
  await requireStaff("/admin/portfolio");
  const { albums, loose, categories } = await getPortfolioAdmin();
  const albumChoices = albums.map((a) => ({ id: a.id, title: a.title }));

  const withUrl = <T extends { storage_path: string }>(photo: T) => ({
    ...photo,
    url: storageUrl("portfolio", photo.storage_path),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Portfolio"
        description="Albums and photos on the public portfolio page. Changes show there straight away."
        action={
          <Link href="/portfolio" className="text-sm text-burgundy-700 underline underline-offset-4">
            View the public page
          </Link>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {albums.map((album) => (
            <section key={album.id} className="rounded-xl border border-sand-300 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">{album.title}</h2>
                  <p className="text-xs text-muted">
                    {categories.find((c) => c.id === album.category_id)?.name ?? "No category"} ·{" "}
                    {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}
                  </p>
                  {album.description ? <p className="mt-1 max-w-xl text-sm text-muted">{album.description}</p> : null}
                </div>
                <ActionButton
                  action={deleteAlbumAction}
                  fields={{ id: album.id }}
                  confirm={
                    album.photos.length
                      ? `Delete “${album.title}” and its ${album.photos.length} photos? The files are removed too.`
                      : `Delete “${album.title}”?`
                  }
                  className="text-red-700"
                >
                  Delete album
                </ActionButton>
              </div>

              <div className="mt-3">
                <AlbumForm album={album} categories={categories} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {album.photos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={withUrl(photo)}
                    isCover={album.cover_path === photo.storage_path}
                    albums={albumChoices}
                  />
                ))}
              </div>

              <div className="mt-4">
                <PhotoUploader albumId={album.id} />
              </div>
            </section>
          ))}

          <section className="rounded-xl border border-sand-300 bg-white p-5">
            <h2 className="font-display text-xl font-semibold text-ink">Not in an album</h2>
            <p className="text-xs text-muted">Shown at the end of the portfolio page.</p>
            {loose.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {loose.map((photo) => (
                  <PhotoCard key={photo.id} photo={withUrl(photo)} isCover={false} albums={albumChoices} />
                ))}
              </div>
            ) : null}
            <div className="mt-4">
              <PhotoUploader albumId={null} />
            </div>
          </section>
        </div>

        <Panel title="New album">
          <AlbumForm categories={categories} />
        </Panel>
      </div>
    </div>
  );
}
