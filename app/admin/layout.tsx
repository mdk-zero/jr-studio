import Link from "next/link";
import { requireStaff } from "@/lib/dal";
import { getInboxCounts } from "@/lib/admin-content";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

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
      {/* Sidebar and work area share one theme, light or dark, chosen by the
          switcher in the header. */}
      <aside className="border-b border-line bg-surface md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 p-4">
          <Link href="/admin" className="flex items-center gap-3 transition-opacity hover:opacity-75">
            <BrandLogo className="size-10" />
            <span className="caps text-muted">Back office</span>
          </Link>
        </div>
        <SidebarNav
          items={NAV.filter((item) => !("adminOnly" in item) || user.role === "admin").map((item) => ({
            href: item.href,
            label: item.label,
            count: "badge" in item ? counts[item.badge] : 0,
          }))}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <p className="text-sm text-muted">
            {user.fullName}
            <span className="ml-2 rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-on-tint">
              {user.role}
            </span>
          </p>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <SignOutButton />
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
