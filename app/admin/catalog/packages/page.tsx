import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/dal";
import { PackagesManager } from "@/components/admin/packages-manager";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Packages" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default async function AdminPackagesPage() {
  await requireAdmin("/admin/catalog/packages");

  const supabase = await createClient();
  const [{ data: packages }, { data: categories }, { data: addons }, { data: links }, { data: bookings }] =
    await Promise.all([
      supabase.from("packages").select("*").order("sort_order"),
      supabase.from("categories").select("id, name").order("sort_order"),
      supabase.from("addons").select("id, name, price").order("name"),
      supabase.from("package_addons").select("package_id, addon_id"),
      supabase.from("bookings").select("package_id"),
    ]);

  const rows = (packages ?? []).map((pkg) => ({
    ...pkg,
    addonIds: (links ?? []).filter((l) => l.package_id === pkg.id).map((l) => l.addon_id),
    bookingCount: (bookings ?? []).filter((b) => b.package_id === pkg.id).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Packages"
        description="What customers can book. Prices here are what the booking flow charges."
      />
      <PackagesManager packages={rows} categories={categories ?? []} addons={addons ?? []} />
    </div>
  );
}
