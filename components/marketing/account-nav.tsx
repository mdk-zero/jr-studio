import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { homePathFor } from "@/lib/auth/roles";

/**
 * The only part of the marketing chrome that depends on the visitor, so it is
 * the only part that cannot be cached. Rendered inside <Suspense> by the layout
 * so the rest of the page is still a static shell.
 */
export async function AccountNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="caps text-burgundy-700 hover:text-burgundy-500">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="caps rounded-full bg-burgundy-600 px-4 py-2 text-white transition hover:bg-burgundy-700"
        >
          Book a session
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href={homePathFor(user.role)} className="caps text-burgundy-700 hover:text-burgundy-500">
        {user.fullName.split(" ")[0]}
      </Link>
      <Link
        href="/book"
        className="caps rounded-full bg-burgundy-600 px-4 py-2 text-white transition hover:bg-burgundy-700"
      >
        Book a session
      </Link>
    </div>
  );
}

export function AccountNavFallback() {
  // Reserves the same height so the header does not shift when this streams in.
  return <div className="h-9 w-40" aria-hidden />;
}
