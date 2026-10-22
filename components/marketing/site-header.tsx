import Link from "next/link";
import { Suspense } from "react";
import { AccountNav, AccountNavFallback } from "@/components/marketing/account-nav";

const LINKS = [
  { href: "/#packages", label: "Packages" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-burgundy-600/10 bg-sand-50/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl leading-none font-semibold text-burgundy-700">
            J&amp;R
          </span>
          <span className="caps text-burgundy-500/70 transition group-hover:text-burgundy-600">
            Studio
          </span>
        </Link>

        <nav aria-label="Site" className="hidden items-center gap-7 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="caps text-muted transition hover:text-burgundy-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Suspense fallback={<AccountNavFallback />}>
          <AccountNav />
        </Suspense>
      </div>

      {/* Phones get the same links as a second row; it scrolls sideways if needed. */}
      <nav aria-label="Site" className="flex gap-6 overflow-x-auto border-t border-burgundy-600/10 px-5 py-2.5 sm:hidden">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="caps shrink-0 text-muted transition hover:text-burgundy-700">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
