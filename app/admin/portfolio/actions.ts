"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import type { ActionState } from "@/app/admin/catalog/actions";
import { albumSchema, photoUpdateSchema, registerPhotosSchema } from "@/lib/validators/content";

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

/** The public portfolio page is cached under this tag. */
function refresh() {
  updateTag("portfolio");
  revalidatePath("/admin/portfolio");
}

async function uniqueAlbumSlug(title: string, ignoreId?: string): Promise<string> {
  const supabase = await createClient();
  const base = slugify(title) || "album";
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase.from("albums").select("id").eq("slug", candidate);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------
export async function saveAlbumAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const parsed = albumSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    category_id: formData.get("category_id") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  const { error } = id
    ? await supabase.from("albums").update(values).eq("id", id)
    : await supabase.from("albums").insert({ ...values, slug: await uniqueAlbumSlug(values.title) });
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: id ? "Album saved." : "Album created. Add photos to it below." };
}

/**
 * Deletes an album with its photos and their files. The legacy portfolio
 * deleted rows and left files behind, which is how its uploads folder ended up
 * holding more dead files than live ones.
 */
export async function deleteAlbumAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "That album could not be found." };

  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("portfolio_photos")
    .select("id, storage_path")
    .eq("album_id", id.data);

  if (photos?.length) {
    const { error } = await supabase.from("portfolio_photos").delete().eq("album_id", id.data);
    if (error) return { message: error.message };
    await supabase.storage.from("portfolio").remove(photos.map((p) => p.storage_path));
  }

  const { error } = await supabase.from("albums").delete().eq("id", id.data);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: `Album deleted${photos?.length ? ` with ${photos.length} photos` : ""}.` };
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * Records photos the browser has already put in Storage.
 *
 * Files go straight from the browser to the `portfolio` bucket (the storage
 * policy admits staff only), because a Server Action body is capped at 1MB and
 * a camera JPEG is several times that. This action only writes the rows.
 */
export async function registerPhotosAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  let photos: unknown;
  try {
    photos = JSON.parse(String(formData.get("photos") ?? "[]"));
  } catch {
    return { message: "The upload list was unreadable. Try again." };
  }

  const parsed = registerPhotosSchema.safeParse({ album_id: formData.get("album_id") ?? undefined, photos });
  if (!parsed.success) return { message: "Those uploads could not be recorded. Try again." };

  const { album_id } = parsed.data;
  const folder = album_id ?? "loose";
  if (parsed.data.photos.some((p) => !p.path.startsWith(`${folder}/`))) {
    return { message: "Those uploads belong to a different album." };
  }

  const supabase = await createClient();
  // New photos go after the ones already there.
  const siblings = supabase.from("portfolio_photos").select("sort_order");
  const { data: last } = await (album_id ? siblings.eq("album_id", album_id) : siblings.is("album_id", null))
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.sort_order ?? 0) + 1;

  let category_id: string | null = null;
  if (album_id) {
    const { data: album } = await supabase.from("albums").select("category_id, cover_path").eq("id", album_id).single();
    category_id = album?.category_id ?? null;
    // The first photo into an empty album becomes its cover.
    if (album && !album.cover_path) {
      await supabase.from("albums").update({ cover_path: parsed.data.photos[0].path }).eq("id", album_id);
    }
  }

  const { error } = await supabase.from("portfolio_photos").insert(
    parsed.data.photos.map((p, i) => ({
      album_id,
      category_id,
      storage_path: p.path,
      width: p.width,
      height: p.height,
      title: p.title,
      sort_order: start + i,
    })),
  );
  if (error) {
    await supabase.storage.from("portfolio").remove(parsed.data.photos.map((p) => p.path));
    return { message: error.message };
  }

  refresh();
  const n = parsed.data.photos.length;
  return { ok: true, message: `${n} photo${n === 1 ? "" : "s"} added.` };
}

export async function updatePhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const parsed = photoUpdateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    album_id: formData.get("album_id") ?? undefined,
    sort_order: formData.get("sort_order") || 0,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("portfolio_photos").update(values).eq("id", id);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Saved." };
}

export async function deletePhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "That photo could not be found." };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("portfolio_photos")
    .select("storage_path, album_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!photo) return { message: "That photo was already deleted." };

  const { error } = await supabase.from("portfolio_photos").delete().eq("id", id.data);
  if (error) return { message: error.message };

  // An album whose cover was this photo would otherwise point at a dead file.
  await supabase.from("albums").update({ cover_path: null }).eq("cover_path", photo.storage_path);
  await supabase.storage.from("portfolio").remove([photo.storage_path]);

  refresh();
  return { ok: true, message: "Photo deleted." };
}

export async function setAlbumCoverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "That photo could not be found." };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("portfolio_photos")
    .select("storage_path, album_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!photo?.album_id) return { message: "Only a photo in an album can be its cover." };

  const { error } = await supabase
    .from("albums")
    .update({ cover_path: photo.storage_path })
    .eq("id", photo.album_id);
  if (error) return { message: error.message };

  refresh();
  return { ok: true, message: "Album cover set." };
}
