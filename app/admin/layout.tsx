import Link from "next/link";
import { requireStaff } from "@/lib/dal";
import { getInboxCounts } from "@/lib/admin-content";
import { SignOutButton } from "@/components/layout/sign-out-button";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

// Sections only an admin can use are hidden from staff, rather than shown and
// then bounced by the page's own check.
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/messages", label: "Messages", badge: "unread" },
  { href: "/admin/testimonials", label: "Reviews", badge: "pendingReviews" },
  { href: "/admin/portfolio", label: "Portfolio" },
  { href: "/admin/catalog/packages", label: "Catalog", adminOnly: true },
  { href: "/admin/staff", label: "Staff", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Authoritative check. proxy.ts only does an optimistic redirect, so this is
  // what actually keeps customers out of the back office.
  const user = await requireStaff("/admin");
  const counts = await getInboxCounts();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-sand-300 bg-white md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 p-4 md:block">
          <Link href="/admin" className="text-xs font-medium tracking-[0.2em] text-burgundy-500 uppercase">
            J&amp;R Admin
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-2">
          {NAV.filter((item) => !("adminOnly" in item) || user.role === "admin").map((item) => {
            const count = "badge" in item ? counts[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-sand-100 hover:text-ink"
              >
                {item.label}
                {count > 0 ? (
                  <span className="nums rounded-full bg-burgundy-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-300 bg-white px-4 py-3">
          <p className="text-sm text-muted">
            {user.fullName}
            <span className="ml-2 rounded-full bg-burgundy-50 px-2 py-0.5 text-xs font-medium text-burgundy-700">
              {user.role}
            </span>
          </p>
          <SignOutButton />
        </header>
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
