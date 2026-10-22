"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number };

/** The admin sidebar links, with the current section marked. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  // A section owns everything under its first path segment: Catalog links to
  // /admin/catalog/packages but stays marked on /admin/catalog/addons.
  const section = (href: string) => href.split("/").slice(0, 3).join("/");
  const active = items.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === section(item.href) || pathname.startsWith(`${section(item.href)}/`),
  )?.href;

  return (
    <nav aria-label="Back office" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-2">
      {items.map((item) => {
        const current = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
              current ? "bg-burgundy-50 font-medium text-burgundy-700" : "text-muted hover:bg-sand-100 hover:text-ink"
            }`}
          >
            {item.label}
            {item.count ? (
              <span className="nums rounded-full bg-burgundy-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
