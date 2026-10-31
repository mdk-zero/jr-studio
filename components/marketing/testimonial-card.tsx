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
    <figure className="flex flex-col border-t border-line pt-6">
      <div className="caps text-brand" aria-label={`Rated ${rating} out of 5`}>
        {"★".repeat(rating)}
        <span className="text-ink/15">{"★".repeat(5 - rating)}</span>
      </div>

      <blockquote className="font-display mt-4 text-xl leading-relaxed text-ink italic">
        <span aria-hidden className="text-brand/60">
          “
        </span>
        {message}
        <span aria-hidden className="text-brand/60">
          ”
        </span>
      </blockquote>

      <figcaption className="caps mt-5 text-muted">
        {authorName ?? "Studio client"}
        {packageName ? <span className="text-brand"> · {packageName}</span> : null}
      </figcaption>
    </figure>
  );
}
