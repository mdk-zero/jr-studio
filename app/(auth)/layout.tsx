import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SESSIONS } from "@/components/marketing/showcase";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * Authenticated area: every render reads the session cookie to decide whether
 * to redirect, so there is no useful static shell to prerender. Opting out of
 * instant-navigation validation lets this segment block on the server instead.
 */
export const instant = false;

const portrait = SESSIONS[0];

/**
 * Split screen on wide displays: the studio's side (a portrait in the
 * viewfinder, dark in either theme) and the form's side, which follows the
 * theme. Phones get the form alone, under the same top bar.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grain flex min-h-full flex-1">
      <aside className="darkroom sticky top-0 hidden h-svh w-1/2 max-w-3xl shrink-0 overflow-hidden lg:block">
        <Image
          src={portrait.image}
          alt={portrait.alt}
          fill
          sizes="50vw"
          placeholder="blur"
          className="object-cover object-[50%_18%]"
        />
        {/* Darkened top and bottom so the logo and the caption always read. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-b from-night-950/55 via-night-950/0 via-35% to-night-950/85"
        />
        <div aria-hidden className="viewfinder absolute inset-8 text-bone [--vf-length:2rem]" />

        <Link
          href="/"
          aria-label="J&R Studio, home"
          className="absolute top-14 left-14 transition-opacity hover:opacity-75"
        >
          <BrandLogo className="size-16 text-bone" />
        </Link>

        <div className="absolute right-14 bottom-14 left-14">
          <p className="font-display text-4xl leading-[1.05] font-semibold text-bone">
            Stills &amp; <em className="font-normal text-burgundy-200">motion</em>,
            <br />
            made to keep.
          </p>
          <p className="caps mt-5 text-bone/70">{portrait.kind} · Shot at J&amp;R Studio</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <Link href="/" className="caps flex items-center gap-2 text-muted transition-colors hover:text-ink">
            <span aria-hidden>←</span>
            Back to site
          </Link>
          <ThemeSwitcher />
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pt-6 pb-20 sm:px-10">
          <div className="w-full max-w-sm">
            <Link href="/" aria-label="J&R Studio, home" className="mb-10 inline-block transition-opacity hover:opacity-75 lg:hidden">
              <BrandLogo className="size-16" />
            </Link>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
