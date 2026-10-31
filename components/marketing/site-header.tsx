import Link from "next/link";
import { Suspense } from "react";
import { AccountNav, AccountNavFallback } from "@/components/marketing/account-nav";
import { BrandLogo } from "@/components/brand-logo";

const LINKS = [
  { href: "/#packages", label: "Packages" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-3">
        <Link href="/" aria-label="J&R Studio, home" className="shrink-0 transition-opacity hover:opacity-75">
          <BrandLogo className="size-11 sm:size-14" />
        </Link>

        <nav aria-label="Site" className="hidden items-center gap-8 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="caps text-muted transition-colors hover:text-ink"
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
      <nav aria-label="Site" className="flex gap-6 overflow-x-auto border-t border-line px-5 py-2.5 sm:hidden">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="caps shrink-0 text-muted transition-colors hover:text-ink">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
