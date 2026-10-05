import Link from "next/link";
import { requireAdmin } from "@/lib/dal";

const TABS = [
  { href: "/admin/catalog/packages", label: "Packages" },
  { href: "/admin/catalog/categories", label: "Categories" },
  { href: "/admin/catalog/addons", label: "Add-ons" },
  { href: "/admin/catalog/promos", label: "Promotions" },
] as const;

export default async function CatalogLayout({ children }: LayoutProps<"/admin/catalog">) {
  // The catalog sets prices, so it is admin-only; staff run shoots.
  await requireAdmin("/admin/catalog/packages");

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 border-b border-sand-300">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-lg px-4 py-2 text-sm text-muted transition hover:bg-sand-100 hover:text-ink"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
