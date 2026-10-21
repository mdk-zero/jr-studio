"use client";

import { createClient } from "@/lib/supabase/client";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type Uploaded = { path: string; width: number | null; height: number | null };

/**
 * Uploads an image from the browser straight to a Storage bucket, as the
 * signed-in user (the bucket's policy admits staff only).
 *
 * Server Actions cap request bodies at 1MB and hosting platforms cap function
 * payloads too, so photos never pass through the app server. The caller then
 * records the returned path with a small Server Action.
 */
export async function uploadImage(bucket: string, folder: string, file: File): Promise<Uploaded> {
  const extension = EXTENSIONS[file.type];
  if (!extension) throw new Error(`${file.name} is not a JPEG, PNG, WebP or AVIF image.`);

  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await createClient()
    .storage.from(bucket)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`${file.name}: ${error.message}`);

  // Dimensions let the public pages reserve space and avoid layout shift.
  let width: number | null = null;
  let height: number | null = null;
  try {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch {
    // Some formats cannot be decoded in every browser; dimensions are optional.
  }

  return { path, width, height };
}

/** Removes uploads that could not be recorded, so they do not linger as orphans. */
export async function removeUploads(bucket: string, paths: string[]): Promise<void> {
  if (paths.length) await createClient().storage.from(bucket).remove(paths);
}
