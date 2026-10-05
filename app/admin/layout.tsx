import Link from "next/link";
import { requireStaff } from "@/lib/dal";
import { SignOutButton } from "@/components/layout/sign-out-button";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/catalog/packages", label: "Catalog" },
  { href: "/admin/portfolio", label: "Portfolio" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/testimonials", label: "Testimonials" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Authoritative check. proxy.ts only does an optimistic redirect, so this is
  // what actually keeps customers out of the back office.
  const user = await requireStaff("/admin");

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-sand-300 bg-white md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 p-4 md:block">
          <Link href="/admin" className="text-xs font-medium tracking-[0.2em] text-burgundy-500 uppercase">
            J&amp;R Admin
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted hover:bg-sand-100 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
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
