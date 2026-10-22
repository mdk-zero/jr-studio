import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" aria-label="J&R Studio, home" className="self-center transition hover:opacity-80">
        <BrandLogo className="size-20" preload />
      </Link>
      <div className="rounded-2xl border border-sand-300 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </main>
  );
}
