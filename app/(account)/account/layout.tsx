import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser("/account");

  return (
    <div className="grain flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="J&R Studio, home" className="shrink-0 transition-opacity hover:opacity-75">
            <BrandLogo className="size-11" />
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/account" className="caps text-muted transition-colors hover:text-ink">My bookings</Link>
            <Link href="/account/profile" className="caps text-muted transition-colors hover:text-ink">Profile</Link>
            <SignOutButton />
            <ThemeSwitcher />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <p className="sr-only">Signed in as {user.email}</p>
        {children}
      </main>
    </div>
  );
}
