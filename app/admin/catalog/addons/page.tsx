import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/dal";
import { AddonsManager } from "@/components/admin/addons-manager";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Add-ons" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default async function AdminAddonsPage() {
  await requireAdmin("/admin/catalog/addons");

  const supabase = await createClient();
  const [{ data: addons }, { data: packages }, { data: links }] = await Promise.all([
    supabase.from("addons").select("id, name, description, price, is_active").order("name"),
    supabase.from("packages").select("id, name").order("sort_order"),
    supabase.from("package_addons").select("package_id, addon_id"),
  ]);

  const rows = (addons ?? []).map((addon) => ({
    ...addon,
    packageIds: (links ?? []).filter((l) => l.addon_id === addon.id).map((l) => l.package_id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add-ons"
        description="Extras customers can add while booking. An add-on only appears for the packages you tick."
      />
      <AddonsManager addons={rows} packages={packages ?? []} />
    </div>
  );
}
