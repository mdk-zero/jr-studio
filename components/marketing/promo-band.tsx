import { formatManilaDate } from "@/lib/datetime";

type Promo = {
  id: string;
  name: string;
  discount_percent: number;
  ends_on: string;
};

/** Current offers, in the safelight's burgundy so they stand apart from the page. */
export function PromoBand({ promos }: { promos: Promo[] }) {
  if (promos.length === 0) return null;

  return (
    <section aria-label="Current offers" className="border-y border-burgundy-500/40 bg-burgundy-800 text-bone">
      <div className="mx-auto w-full max-w-6xl divide-y divide-bone/15 px-5">
        {promos.map((promo) => (
          <div
            key={promo.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-6"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-display nums text-4xl leading-none font-semibold sm:text-5xl">
                {promo.discount_percent}%
              </span>
              <span className="caps text-burgundy-200">off</span>
            </div>
            <p className="font-display text-xl italic">{promo.name}</p>
            <p className="caps nums text-burgundy-200">
              {/* Dates are inclusive, as the studio has always run them. */}
              Until {formatManilaDate(`${promo.ends_on}T12:00:00Z`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
