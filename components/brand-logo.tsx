/**
 * The studio's logo mark, painted in `currentColor`: bone on the darkroom
 * pages, burgundy in the back office. `public/logo.png` is a transparent,
 * single-colour copy of `public/J&R Logo.jpg`, so its alpha channel is the
 * artwork and works as a mask. Size it with a `size-*` class; the file is
 * 200px square for sharp 2x display. Colour defaults to the theme's heading
 * colour and follows any `text-*` class passed in.
 */
export function BrandLogo({ className = "size-12" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="J&R Studio"
      className={`inline-block shrink-0 bg-current ${className.includes("text-") ? "" : "text-heading"} ${className}`}
      style={{
        mask: "url(/logo.png) center / contain no-repeat",
        WebkitMask: "url(/logo.png) center / contain no-repeat",
      }}
    />
  );
}
