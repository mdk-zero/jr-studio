"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import {
  addonSchema,
  categorySchema,
  idSchema,
  packageSchema,
  promotionSchema,
} from "@/lib/validators/catalog";

export type ActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
};

function invalid(error: z.ZodError): ActionState {
  return { errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

/**
 * Postgres errors worth translating. Catalog rows are referenced by bookings
 * with ON DELETE RESTRICT, so deleting a booked package fails by design —
 * the admin should deactivate it instead of losing booking history.
 */
function describe(error: { code?: string; message: string }): string {
  if (error.code === "23503") {
    return "This is used by existing bookings, so it cannot be deleted. Deactivate it instead to hide it from customers.";
  }
  if (error.code === "23505") {
    return "Something with that name already exists.";
  }
  return error.message;
}

/** Every catalog write ends here, so the public pages pick the change up at once. */
function revalidateCatalog() {
  updateTag("catalog");
}

async function uniqueSlug(
  table: "packages" | "categories",
  name: string,
  ignoreId?: string,
): Promise<string> {
  const supabase = await createClient();
  const base = slugify(name) || "item";

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase.from(table).select("id").eq("slug", candidate);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    sort_order: formData.get("sort_order") || 0,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  const { error } = id
    ? await supabase.from("categories").update(values).eq("id", id)
    : await supabase
        .from("categories")
        .insert({ ...values, slug: await uniqueSlug("categories", values.name) });

  if (error) return { message: describe(error) };

  revalidateCatalog();
  return { ok: true, message: id ? "Category updated." : "Category added." };
}

export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id);
  if (error) return { message: describe(error) };

  revalidateCatalog();
  return { ok: true, message: "Category deleted." };
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------
export async function savePackage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = packageSchema.safeParse({
    id: formData.get("id") || undefined,
    category_id: formData.get("category_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    duration_minutes: formData.get("duration_minutes"),
    inclusions: formData.get("inclusions"),
    outfits: formData.get("outfits"),
    backdrops: formData.get("backdrops"),
    photos_included: formData.get("photos_included"),
    magazine_cover: formData.get("magazine_cover") === "on",
    digital_images: formData.get("digital_images") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: formData.get("sort_order") || 0,
    addon_ids: formData.getAll("addon_ids").map(String),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, addon_ids, ...values } = parsed.data;

  let packageId = id;

  if (id) {
    const { error } = await supabase.from("packages").update(values).eq("id", id);
    if (error) return { message: describe(error) };
  } else {
    const { data, error } = await supabase
      .from("packages")
      .insert({ ...values, slug: await uniqueSlug("packages", values.name) })
      .select("id")
      .single();
    if (error) return { message: describe(error) };
    packageId = data.id;
  }

  // Replace the add-on links. Safe to delete first: package_addons is only a
  // join table, and booking_addons keeps its own price snapshot.
  if (packageId) {
    await supabase.from("package_addons").delete().eq("package_id", packageId);
    if (addon_ids.length > 0) {
      const { error } = await supabase
        .from("package_addons")
        .insert(addon_ids.map((addon_id) => ({ package_id: packageId!, addon_id })));
      if (error) return { message: describe(error) };
    }
  }

  revalidateCatalog();
  return { ok: true, message: id ? "Package updated." : "Package added." };
}

export async function togglePackageActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("packages")
    .select("is_active")
    .eq("id", parsed.data.id)
    .single();

  const { error } = await supabase
    .from("packages")
    .update({ is_active: !current?.is_active })
    .eq("id", parsed.data.id);

  if (error) return { message: describe(error) };

  revalidateCatalog();
  return { ok: true };
}

export async function deletePackage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("packages").delete().eq("id", parsed.data.id);
  if (error) return { message: describe(error) };

  revalidateCatalog();
  return { ok: true, message: "Package deleted." };
}

/**
 * Points a package at a cover the browser has already uploaded to the
 * `packages` bucket, and removes the previous file.
 *
 * The file itself never passes through here: Server Actions cap request bodies
 * at 1MB, which a phone photo exceeds several times over.
 */
export async function setPackageCover(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({
      id: z.string().uuid(),
      path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpe?g|png|webp|avif)$/i),
    })
    .safeParse({ id: formData.get("id"), path: formData.get("path") });
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.id}/`)) {
    return { message: "Upload an image first." };
  }
  const { id, path } = parsed.data;

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("packages")
    .select("cover_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("packages").update({ cover_path: path }).eq("id", id);
  if (error) return { message: describe(error) };

  // Drop the old file so the bucket does not accumulate orphans, which is how
  // the legacy uploads folder ended up with more dead files than live ones.
  if (previous?.cover_path && previous.cover_path !== path) {
    await supabase.storage.from("packages").remove([previous.cover_path]);
  }

  revalidateCatalog();
  return { ok: true, message: "Cover image updated." };
}

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------
export async function saveAddon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = addonSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    is_active: formData.get("is_active") === "on",
    package_ids: formData.getAll("package_ids").map(String),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, package_ids, ...values } = parsed.data;

  let addonId = id;
  if (id) {
    const { error } = await supabase.from("addons").update(values).eq("id", id);
    if (error) return { message: describe(error) };
  } else {
    const { data, error } = await supabase.from("addons").insert(values).select("id").single();
    if (error) return { message: describe(error) };
    addonId = data.id;
  }

  if (addonId) {
    await supabase.from("package_addons").delete().eq("addon_id", addonId);
    if (package_ids.length > 0) {
      const { error } = await supabase
        .from("package_addons")
        .insert(package_ids.map((package_id) => ({ addon_id: addonId!, package_id })));
      if (error) return { message: describe(error) };
    }
  }

  revalidateCatalog();
  return { ok: true, message: id ? "Add-on updated." : "Add-on added." };
}

export async function deleteAddon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("addons").delete().eq("id", parsed.data.id);
  if (error) return { message: describe(error) };

  revalidateCatalog();
  return { ok: true, message: "Add-on deleted." };
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------
export async function savePromotion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = promotionSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    discount_percent: formData.get("discount_percent"),
    starts_on: formData.get("starts_on"),
    ends_on: formData.get("ends_on"),
    visible_to_customers: formData.get("visible_to_customers") === "on",
    package_ids: formData.getAll("package_ids").map(String),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { id, package_ids, ...values } = parsed.data;

  let promotionId = id;
  if (id) {
    const { error } = await supabase.from("promotions").update(values).eq("id", id);
    if (error) return { message: describe(error) };
  } else {
    const { data, error } = await supabase
      .from("promotions")
      .insert(values)
      .select("id")
      .single();
    if (error) return { message: describe(error) };
    promotionId = data.id;
  }

  if (promotionId) {
    await supabase.from("promotion_packages").delete().eq("promotion_id", promotionId);
    if (package_ids.length > 0) {
      const { error } = await supabase
        .from("promotion_packages")
        .insert(package_ids.map((package_id) => ({ promotion_id: promotionId!, package_id })));
      if (error) return { message: describe(error) };
    }
  }

  revalidateCatalog();
  return { ok: true, message: id ? "Promotion updated." : "Promotion added." };
}

export async function deletePromotion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("promotions").delete().eq("id", parsed.data.id);
  if (error) return { message: describe(error) };

  revalidateCatalog();
  return { ok: true, message: "Promotion deleted." };
}
