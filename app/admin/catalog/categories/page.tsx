import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/dal";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Categories" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default async function CategoriesPage() {
  await requireAdmin("/admin/catalog/categories");

  const supabase = await createClient();
  const [{ data: categories }, { data: packages }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, sort_order, is_active")
      .order("sort_order"),
    supabase.from("packages").select("category_id"),
  ]);

  const rows = (categories ?? []).map((category) => ({
    ...category,
    packageCount: (packages ?? []).filter((p) => p.category_id === category.id).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="How packages are grouped on the public site."
      />
      <CategoriesManager categories={rows} />
    </div>
  );
}
