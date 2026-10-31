import Link from "next/link";
import type { Viewport } from "next";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

export const viewport: Viewport = { themeColor: "#0c0a0a" };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="darkroom grain backdrop flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12">
        <Link href="/" aria-label="J&R Studio, home" className="self-center transition-opacity hover:opacity-75">
          <BrandLogo className="size-20" />
        </Link>
        {/* The form sits in frame, with the viewfinder's brackets just outside it. */}
        <div className="viewfinder text-muted/60 [--vf-inset:-0.625rem]">
          <div className="border border-line bg-surface/90 p-6 text-ink backdrop-blur-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
