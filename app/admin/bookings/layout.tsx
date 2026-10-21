import Link from "next/link";
import { requireStaff } from "@/lib/dal";

const TABS = [
  { href: "/admin/bookings", label: "List" },
  { href: "/admin/bookings/calendar", label: "Calendar" },
  { href: "/admin/bookings/new", label: "New booking" },
] as const;

export default async function BookingsLayout({ children }: LayoutProps<"/admin/bookings">) {
  // Staff run the desk day to day, so this section is not admin-only.
  await requireStaff("/admin/bookings");

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
