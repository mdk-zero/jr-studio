import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/dal";
import { PromosManager } from "@/components/admin/promos-manager";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Promotions" };

export default async function AdminPromosPage() {
  await requireAdmin("/admin/catalog/promos");

  const supabase = await createClient();
  const [{ data: promos }, { data: packages }, { data: links }] = await Promise.all([
    // The view carries the computed status; the table has no status column.
    supabase.from("promotions_with_status").select("*").order("starts_on", { ascending: false }),
    supabase.from("packages").select("id, name").order("sort_order"),
    supabase.from("promotion_packages").select("promotion_id, package_id"),
  ]);

  const rows = (promos ?? []).flatMap((promo) =>
    promo.id &&
    promo.name &&
    promo.discount_percent !== null &&
    promo.starts_on &&
    promo.ends_on
      ? [
          {
            id: promo.id,
            name: promo.name,
            discount_percent: promo.discount_percent,
            starts_on: promo.starts_on,
            ends_on: promo.ends_on,
            visible_to_customers: promo.visible_to_customers ?? false,
            status: promo.status ?? "expired",
            packageIds: (links ?? [])
              .filter((l) => l.promotion_id === promo.id)
              .map((l) => l.package_id),
          },
        ]
      : [],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promotions"
        description="Discounts applied automatically while the dates are current. Status is worked out from the dates, so an ended promotion stops applying on its own."
      />
      <PromosManager promotions={rows} packages={packages ?? []} />
    </div>
  );
}
