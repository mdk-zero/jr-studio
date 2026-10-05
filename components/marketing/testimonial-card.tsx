export function TestimonialCard({
  message,
  rating,
  authorName,
  packageName,
}: {
  message: string;
  rating: number;
  authorName: string | null;
  packageName?: string | null;
}) {
  return (
    <figure className="flex flex-col border-t border-burgundy-600/15 pt-5">
      <div
        className="caps text-burgundy-500"
        aria-label={`Rated ${rating} out of 5`}
      >
        {"★".repeat(rating)}
        <span className="text-burgundy-600/25">{"★".repeat(5 - rating)}</span>
      </div>

      <blockquote className="font-display mt-4 text-lg leading-relaxed text-ink">
        <span aria-hidden className="text-burgundy-500/40">
          “
        </span>
        {message}
        <span aria-hidden className="text-burgundy-500/40">
          ”
        </span>
      </blockquote>

      <figcaption className="caps mt-4 text-muted">
        {authorName ?? "Studio client"}
        {packageName ? <span className="text-burgundy-500/60"> · {packageName}</span> : null}
      </figcaption>
    </figure>
  );
}
