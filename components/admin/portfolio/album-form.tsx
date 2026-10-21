"use client";

import { useActionState, useState } from "react";
import { saveAlbumAction } from "@/app/admin/portfolio/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { useFormMemory } from "@/components/forms/use-form-memory";

type Album = { id: string; title: string; category_id: string | null; description: string | null };

const initial: ActionState = {};

/** New album, or the inline "Edit album" form under an album's heading. */
export function AlbumForm({
  album,
  categories,
}: {
  album?: Album;
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(saveAlbumAction, initial);
  const memory = useFormMemory(state);
  const [open, setOpen] = useState(!album);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Edit album
      </button>
    );
  }

  const prefix = album ? `album-${album.id}` : "album-new";

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      {album ? <input type="hidden" name="id" value={album.id} /> : null}
      <div>
        <label htmlFor={`${prefix}-title`} className="text-sm font-medium text-ink">Title</label>
        <input id={`${prefix}-title`} name="title" required defaultValue={memory.text("title", album?.title)} className={`${adminInput} mt-1`} />
        <FieldError errors={state.errors?.title} />
      </div>
      <div>
        <label htmlFor={`${prefix}-category`} className="text-sm font-medium text-ink">Category</label>
        <select id={`${prefix}-category`} name="category_id" defaultValue={memory.text("category_id", album?.category_id)} className={`${adminInput} mt-1`}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-description`} className="text-sm font-medium text-ink">Description</label>
        <textarea id={`${prefix}-description`} name="description" rows={2} maxLength={600} defaultValue={memory.text("description", album?.description)} className={`${adminInput} mt-1`} />
      </div>
      <div className="flex gap-2">
        <SubmitButton quiet={Boolean(album)} className={album ? "px-4 py-2 text-sm" : ""}>
          {album ? "Save album" : "Create album"}
        </SubmitButton>
        {album ? (
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        ) : null}
      </div>
    </form>
  );
}
