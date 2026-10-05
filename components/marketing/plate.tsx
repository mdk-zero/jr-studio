import Image from "next/image";
import { storageUrl } from "@/lib/catalog";

/**
 * A framed image slot. When no photograph exists yet it renders as an empty
 * plate with a caption, which reads as a contact sheet rather than a broken
 * image — the studio can fill these in from the admin area.
 */
export function Plate({
  bucket,
  path,
  alt,
  caption,
  className = "",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: {
  bucket: string;
  path?: string | null;
  alt: string;
  caption?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const url = storageUrl(bucket, path);

  return (
    <div className={`plate ${url ? "" : "plate-empty"} ${className}`}>
      {url ? (
        <Image src={url} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-end p-4">
          <span className="caps text-burgundy-600/55">{caption ?? "Plate pending"}</span>
        </div>
      )}
    </div>
  );
}
