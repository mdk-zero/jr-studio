"use client";

import { useActionState, useState } from "react";
import { deletePhotoAction, setAlbumCoverAction, updatePhotoAction } from "@/app/admin/portfolio/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { ActionButton } from "@/components/admin/action-button";
import { useFormMemory } from "@/components/forms/use-form-memory";

type Photo = {
  id: string;
  album_id: string | null;
  title: string | null;
  sort_order: number;
  url: string | null;
  width: number | null;
  height: number | null;
};

const initial: ActionState = {};

export function PhotoCard({
  photo,
  isCover,
  albums,
}: {
  photo: Photo;
  isCover: boolean;
  albums: Array<{ id: string; title: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updatePhotoAction, initial);
  const memory = useFormMemory(state);

  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-sand-300 bg-white p-2">
      <div className="relative aspect-square overflow-hidden rounded-md bg-sand-100">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail straight from Storage
          <img src={photo.url} alt={photo.title ?? ""} loading="lazy" className="size-full object-cover" />
        ) : null}
        {isCover ? (
          <span className="absolute top-2 left-2 rounded-full bg-burgundy-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            Cover
          </span>
        ) : null}
      </div>
      <figcaption className="flex flex-col gap-1 px-1 text-xs">
        <span className="truncate text-ink">{photo.title || "Untitled"}</span>
        {photo.width && photo.height ? (
          <span className="nums text-muted">{photo.width} × {photo.height}</span>
        ) : null}
      </figcaption>

      {editing ? (
        <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-2 px-1">
          <ActionFeedback state={state} />
          <input type="hidden" name="id" value={photo.id} />
          <input name="title" defaultValue={memory.text("title", photo.title)} placeholder="Caption" maxLength={120} className={`${adminInput} py-1 text-xs`} aria-label="Caption" />
          <select name="album_id" defaultValue={memory.text("album_id", photo.album_id)} className={`${adminInput} py-1 text-xs`} aria-label="Album">
            <option value="">No album</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <input name="sort_order" type="number" min={0} defaultValue={memory.text("sort_order", photo.sort_order)} className={`${adminInput} py-1 text-xs`} aria-label="Order" />
          <div className="flex gap-2">
            <SubmitButton quiet pendingLabel="…">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:text-ink">Close</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-1 pb-1">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-muted hover:text-ink">
            Edit
          </button>
          {photo.album_id && !isCover ? (
            <ActionButton action={setAlbumCoverAction} fields={{ id: photo.id }} feedback="error" className="border-0 bg-transparent px-0 py-0 text-xs text-muted hover:bg-transparent hover:text-ink">
              Make cover
            </ActionButton>
          ) : null}
          <ActionButton
            action={deletePhotoAction}
            fields={{ id: photo.id }}
            confirm="Delete this photo? The file is removed too."
            feedback="error"
            className="border-0 bg-transparent px-0 py-0 text-xs text-muted hover:bg-transparent hover:text-red-700"
          >
            Delete
          </ActionButton>
        </div>
      )}
    </figure>
  );
}
