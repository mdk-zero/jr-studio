import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { toManilaDateString } from "@/lib/datetime";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Public catalog reads.
 *
 * Every function here is cached and tagged, and uses the COOKIE-LESS client, so
 * nothing user-specific can end up in a shared cache entry (a `use cache` scope
 * cannot read cookies anyway). Admin mutations call updateTag() with the
 * matching tag, so an edit shows up on the public site immediately.
 *
 * cacheLife('hours') bounds staleness for things that change with the calendar
 * rather than with an edit — a promotion starting or ending today is not an
 * edit, so no updateTag fires for it.
 */

export type Category = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "slug" | "name" | "description" | "cover_path" | "sort_order"
>;

export type PackageCard = Pick<
  Database["public"]["Tables"]["packages"]["Row"],
  | "id"
  | "slug"
  | "name"
  | "description"
  | "price"
  | "duration_minutes"
  | "photos_included"
  | "cover_path"
  | "category_id"
  | "sort_order"
>;

const CARD_FIELDS =
  "id, slug, name, description, price, duration_minutes, photos_included, cover_path, category_id, sort_order";

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, slug, name, description, cover_path, sort_order")
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}

export async function getPackages(): Promise<PackageCard[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("packages")
    .select(CARD_FIELDS)
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}

/** Categories with their packages, skipping any category with nothing to book. */
export async function getCatalog(): Promise<
  Array<Category & { packages: PackageCard[] }>
> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const [categories, packages] = await Promise.all([getCategories(), getPackages()]);

  return categories
    .map((category) => ({
      ...category,
      packages: packages.filter((p) => p.category_id === category.id),
    }))
    .filter((category) => category.packages.length > 0);
}

export type PackageDetail = Database["public"]["Tables"]["packages"]["Row"] & {
  category: Category | null;
  images: Array<{ storage_path: string; alt: string | null }>;
  addons: Array<{ id: string; name: string; description: string | null; price: number }>;
  quote: {
    package_price: number;
    discount_percent: number | null;
    discount_amount: number;
    total_amount: number;
  };
};

export async function getPackageDetail(slug: string): Promise<PackageDetail | null> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const supabase = createPublicClient();

  const { data: pkg, error } = await supabase
    .from("packages")
    .select("*, categories(id, slug, name, description, cover_path, sort_order)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!pkg) return null;

  const [{ data: images }, { data: links }, { data: quote }] = await Promise.all([
    supabase
      .from("package_images")
      .select("storage_path, alt")
      .eq("package_id", pkg.id)
      .order("sort_order"),
    supabase
      .from("package_addons")
      .select("addons(id, name, description, price, is_active)")
      .eq("package_id", pkg.id),
    // The one pricing formula, so the page can never disagree with checkout.
    supabase.rpc("quote_booking", { p_package_id: pkg.id }),
  ]);

  const { categories, ...rest } = pkg;
  const row = quote?.[0];

  return {
    ...rest,
    category: categories,
    images: images ?? [],
    addons: (links ?? [])
      .map((l) => l.addons)
      .filter((a): a is NonNullable<typeof a> => Boolean(a?.is_active))
      .map(({ id, name, description, price }) => ({ id, name, description, price })),
    quote: {
      package_price: Number(row?.package_price ?? pkg.price),
      discount_percent: row?.discount_percent ?? null,
      discount_amount: Number(row?.discount_amount ?? 0),
      total_amount: Number(row?.total_amount ?? pkg.price),
    },
  };
}

/** Slugs for prerendering package pages. */
export async function getPackageSlugs(): Promise<string[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const { data, error } = await createPublicClient().from("packages").select("slug");
  if (error) throw error;
  return (data ?? []).map((p) => p.slug);
}

/**
 * Promotions a visitor should see. RLS already limits anon to visible promos
 * whose date range covers today, and the view computes status in Manila, so
 * there is no stale status column to filter on.
 */
export type ActivePromotion = {
  id: string;
  name: string;
  discount_percent: number;
  starts_on: string;
  ends_on: string;
};

export async function getActivePromotions(): Promise<ActivePromotion[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("promotions_with_status")
    .select("id, name, discount_percent, starts_on, ends_on, status")
    .eq("status", "active")
    .order("discount_percent", { ascending: false });

  if (error) throw error;

  // Postgres views lose NOT NULL, so every column comes back optional in the
  // generated types. Narrow once here rather than casting at each call site.
  return (data ?? []).flatMap((row) =>
    row.id && row.name && row.discount_percent !== null && row.starts_on && row.ends_on
      ? [
          {
            id: row.id,
            name: row.name,
            discount_percent: row.discount_percent,
            starts_on: row.starts_on,
            ends_on: row.ends_on,
          },
        ]
      : [],
  );
}

export async function getPublicTestimonials(limit = 6) {
  "use cache";
  cacheTag("testimonials");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("testimonials")
    .select("id, rating, message, author_name, is_featured, created_at, packages(name)")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getStudioSettings() {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("studio_settings")
    .select("studio_name, phone, email, address, map_url, socials")
    .single();

  if (error) throw error;
  return data;
}

export async function getBusinessHours() {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("business_hours")
    .select("weekday, is_open, opens_at, closes_at")
    .order("weekday");

  if (error) throw error;
  return data ?? [];
}

export async function getPortfolio() {
  "use cache";
  cacheTag("portfolio");
  cacheLife("hours");

  const supabase = createPublicClient();

  const [{ data: albums }, { data: photos }] = await Promise.all([
    supabase
      .from("albums")
      .select("id, title, slug, description, cover_path, categories(name, slug)")
      .order("created_at", { ascending: false }),
    supabase
      .from("portfolio_photos")
      .select("id, album_id, title, storage_path, width, height, categories(name, slug)")
      .order("sort_order"),
  ]);

  return {
    albums: (albums ?? []).map((album) => ({
      ...album,
      photos: (photos ?? []).filter((p) => p.album_id === album.id),
    })),
    loose: (photos ?? []).filter((p) => !p.album_id),
  };
}

/** Active staff the studio chose to show on the About page. */
export async function getAboutTeam() {
  "use cache";
  cacheTag("staff");
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("staff_members")
    .select("id, full_name, position, bio, photo_path")
    .eq("show_on_about", true)
    .eq("status", "active")
    .order("sort_order")
    .order("full_name");

  if (error) throw error;
  return data ?? [];
}

/** Public URL for a path in a public Storage bucket. */
export function storageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return createPublicClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * The current year, in Manila, as a cached value.
 *
 * Reading `new Date()` directly in a component breaks prerendering under Cache
 * Components, because the value can change between renders. Caching it with a
 * daily lifetime makes it prerenderable and still correct.
 */
export async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return Number(toManilaDateString().slice(0, 4));
}
