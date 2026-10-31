import Image from "next/image";
import { storageUrl } from "@/lib/catalog";

/**
 * A framed image slot. With no photograph yet it renders as a lit, empty
 * backdrop inside viewfinder brackets, which reads as a frame waiting for its
 * subject rather than a broken image. The studio fills these from the admin.
 */
export function Plate({
  bucket,
  path,
  alt,
  caption,
  className = "",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  preload = false,
}: {
  bucket: string;
  path?: string | null;
  alt: string;
  caption?: string;
  className?: string;
  sizes?: string;
  preload?: boolean;
}) {
  const url = storageUrl(bucket, path);

  return (
    <div className={`plate ${url ? "" : "viewfinder [--vf-inset:0.75rem]"} ${className}`}>
      {url ? (
        <Image src={url} alt={alt} fill sizes={sizes} preload={preload} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-end p-6">
          <span className="caps text-muted">{caption ?? "Plate pending"}</span>
        </div>
      )}
    </div>
  );
}
