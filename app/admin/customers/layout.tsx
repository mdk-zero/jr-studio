import Link from "next/link";
import { requireStaff } from "@/lib/dal";

export default async function CustomersLayout({ children }: LayoutProps<"/admin/customers">) {
  const user = await requireStaff("/admin/customers");

  const tabs = [
    { href: "/admin/customers", label: "All customers" },
    { href: "/admin/customers/new", label: "Add customer" },
    // Promotional email goes to everyone who opted in, so it stays with admins.
    ...(user.role === "admin" ? [{ href: "/admin/customers/email", label: "Email customers" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 border-b border-sand-300">
        {tabs.map((tab) => (
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
