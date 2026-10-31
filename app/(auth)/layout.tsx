import Image from "next/image";
import Link from "next/link";
import type { Viewport } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { SESSIONS } from "@/components/marketing/showcase";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

export const viewport: Viewport = { themeColor: "#0c0a0a" };

const portrait = SESSIONS[0];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="darkroom grain flex min-h-full flex-1">
      {/* Wide screens get a studio portrait beside the form. It stays put
          while a long form (sign-up) scrolls. Phones skip it entirely. */}
      <aside className="sticky top-0 hidden h-svh w-[42%] max-w-2xl shrink-0 lg:block">
        <Image
          src={portrait.image}
          alt={portrait.alt}
          fill
          sizes="42vw"
          placeholder="blur"
          className="object-cover object-top"
        />
        <div aria-hidden className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-canvas to-canvas/0" />
        <div aria-hidden className="viewfinder absolute inset-8 text-bone [--vf-length:1.75rem]" />
        <p className="caps absolute bottom-14 left-14 text-bone/85">{portrait.kind} · J&amp;R Studio</p>
      </aside>

      <main className="backdrop flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-md flex-col gap-8">
          <Link href="/" aria-label="J&R Studio, home" className="self-center transition-opacity hover:opacity-75">
            <BrandLogo className="size-20" />
          </Link>
          {/* The form sits in frame, with the viewfinder's brackets just outside it. */}
          <div className="viewfinder text-muted/60 [--vf-inset:-0.625rem]">
            <div className="border border-line bg-surface/90 p-6 text-ink backdrop-blur-sm sm:p-8">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
