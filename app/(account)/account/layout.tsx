import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { SignOutButton } from "@/components/layout/sign-out-button";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser("/account");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-sand-300 bg-white">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-xs font-medium tracking-[0.2em] text-burgundy-500 uppercase">
            J&amp;R Studio
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/account" className="text-muted hover:text-ink">My bookings</Link>
            <Link href="/account/profile" className="text-muted hover:text-ink">Profile</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <p className="sr-only">Signed in as {user.email}</p>
        {children}
      </main>
    </div>
  );
}
