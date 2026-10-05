import { formatManilaDate } from "@/lib/datetime";

type Promo = {
  id: string;
  name: string;
  discount_percent: number;
  ends_on: string;
};

export function PromoBand({ promos }: { promos: Promo[] }) {
  if (promos.length === 0) return null;

  return (
    <section aria-label="Current offers" className="bg-burgundy-700 text-sand-100">
      <div className="mx-auto w-full max-w-6xl divide-y divide-sand-100/15 px-5">
        {promos.map((promo) => (
          <div
            key={promo.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-6"
          >
            <div className="flex items-baseline gap-4">
              <span className="font-display nums text-4xl leading-none font-semibold text-sand-100 sm:text-5xl">
                {promo.discount_percent}%
              </span>
              <span className="caps text-sand-200/80">off</span>
            </div>
            <p className="font-display text-xl text-sand-100">{promo.name}</p>
            <p className="caps nums text-sand-200/70">
              {/* Dates are inclusive, as the studio has always run them. */}
              Until {formatManilaDate(`${promo.ends_on}T12:00:00Z`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
