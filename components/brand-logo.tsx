import Image from "next/image";

/**
 * The studio's logo mark. `public/logo.png` is a transparent copy of
 * `public/J&R Logo.jpg` (trimmed, white turned to transparency in the logo's
 * own colour), so it sits cleanly on the beige header as well as on white.
 * Size it with a `size-*` class; the file is 200px square for sharp 2x display.
 */
export function BrandLogo({ className = "size-12", preload = false }: { className?: string; preload?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="J&R Studio"
      width={200}
      height={200}
      preload={preload}
      className={className}
    />
  );
}
