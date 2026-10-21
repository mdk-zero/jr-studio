"use client";

import { useState, useTransition } from "react";
import { registerPhotosAction } from "@/app/admin/portfolio/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { removeUploads, uploadImage, type Uploaded } from "@/lib/storage-upload";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Several photos at once into one album (or none). Each file goes straight
 * to Storage from the browser; once all are up, one Server Action records
 * them. If recording fails, the uploaded files are removed again so nothing
 * is left in the bucket without a row pointing at it.
 */
export function PhotoUploader({ albumId }: { albumId: string | null }) {
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ActionState>({});
  const [errors, setErrors] = useState<string[]>([]);

  function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;

    const tooBig = files.filter((f) => f.size > MAX_BYTES).map((f) => `${f.name} is over 20MB.`);
    const usable = files.filter((f) => f.size <= MAX_BYTES).slice(0, 50);
    setErrors(tooBig);
    setResult({});

    startTransition(async () => {
      const done: Uploaded[] = [];
      const failed: string[] = [];
      for (const [index, file] of usable.entries()) {
        setProgress(`Uploading ${index + 1} of ${usable.length}…`);
        try {
          done.push(await uploadImage("portfolio", albumId ?? "loose", file));
        } catch (cause) {
          failed.push(cause instanceof Error ? cause.message : `${file.name} failed.`);
        }
      }
      setProgress(done.length ? "Saving…" : null);
      setErrors((prev) => [...prev, ...failed]);
      if (done.length === 0) return;

      const form = new FormData();
      form.set("album_id", albumId ?? "");
      form.set(
        "photos",
        JSON.stringify(done.map((d) => ({ path: d.path, width: d.width, height: d.height, title: "" }))),
      );
      const outcome = await registerPhotosAction({}, form);
      if (!outcome.ok) await removeUploads("portfolio", done.map((d) => d.path));
      setProgress(null);
      setResult(outcome);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <ActionFeedback state={result} />
      {errors.map((e) => (
        <p key={e} role="alert" className="text-xs text-red-700">{e}</p>
      ))}
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-center text-sm text-muted transition hover:border-burgundy-300 hover:text-ink ${
          pending ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <span className="font-medium text-ink">{progress ?? "Add photos"}</span>
        <span className="text-xs">JPEG, PNG, WebP or AVIF · up to 20MB each · up to 50 at a time</span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
