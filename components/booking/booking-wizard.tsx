"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createBookingAction, type BookingState } from "@/app/(booking)/book/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatManilaDate, formatManilaTime, manilaToday, addDaysToDateString } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { inputClass } from "@/components/ui/field";

type Pkg = {
  id: string;
  slug: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string;
  addons: Array<{ id: string; name: string; price: number }>;
};

type Slot = { starts_at: string; ends_at: string };

type Quote = {
  package_price: number;
  addons_total: number;
  discount_percent: number | null;
  discount_amount: number;
  total_amount: number;
};

const initial: BookingState = {};

export function BookingWizard({
  packages,
  preselectedSlug,
  maxAdvanceDays,
}: {
  packages: Pkg[];
  preselectedSlug?: string;
  maxAdvanceDays: number;
}) {
  const [packageId, setPackageId] = useState<string>(
    () => packages.find((p) => p.slug === preselectedSlug)?.id ?? "",
  );
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState<string>("");
  const [chosenSlotStart, setChosenSlotStart] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [state, action, pending] = useActionState(createBookingAction, initial);

  // Results are cached by the inputs they belong to. Changing the package or
  // date therefore yields "not loaded yet" on its own, so nothing has to be
  // reset imperatively from an effect.
  const [slotCache, setSlotCache] = useState<Record<string, Slot[]>>({});
  const [quoteCache, setQuoteCache] = useState<Record<string, Quote>>({});

  const slotKey = packageId && date ? `${packageId}|${date}` : "";
  const slots = slotKey ? slotCache[slotKey] : undefined;
  const loadingSlots = Boolean(slotKey) && slots === undefined;

  const quoteKey = packageId ? `${packageId}|${[...addonIds].sort().join(",")}` : "";
  const quote = quoteKey ? quoteCache[quoteKey] : undefined;

  // A slot stays selected only while it is still on offer for the current
  // package and date.
  const slot = slots?.find((s) => s.starts_at === chosenSlotStart) ?? null;

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packageId, packages],
  );

  const today = manilaToday();
  const lastDate = addDaysToDateString(today, maxAdvanceDays);

  // Add-ons belong to a package, so they clear when the package changes. The
  // slot needs no reset: it is derived from the current slot list.
  function choosePackage(id: string) {
    setPackageId(id);
    setAddonIds([]);
  }

  // Availability comes from the server (available_slots), never from a
  // hardcoded list — the legacy booking page offered fixed hours and only
  // discovered a clash at submit.
  useEffect(() => {
    if (!slotKey || slotCache[slotKey]) return;
    let cancelled = false;

    createClient()
      .rpc("available_slots", { p_package_id: packageId, p_date: date })
      .then(({ data, error }) => {
        if (cancelled) return;
        setSlotCache((prev) => ({ ...prev, [slotKey]: error ? [] : ((data ?? []) as Slot[]) }));
      });

    return () => {
      cancelled = true;
    };
  }, [slotKey, slotCache, packageId, date]);

  // The price preview uses quote_booking, the same function the server uses to
  // write the booking, so what is shown is what is charged.
  useEffect(() => {
    if (!quoteKey || quoteCache[quoteKey]) return;
    let cancelled = false;

    createClient()
      .rpc("quote_booking", { p_package_id: packageId, p_addon_ids: addonIds })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const row = (data ?? [])[0];
        if (!row) return;
        setQuoteCache((prev) => ({
          ...prev,
          [quoteKey]: {
            package_price: Number(row.package_price),
            addons_total: Number(row.addons_total),
            discount_percent: row.discount_percent,
            discount_amount: Number(row.discount_amount),
            total_amount: Number(row.total_amount),
          },
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [quoteKey, quoteCache, packageId, addonIds]);

  const chosenAddons = selected?.addons.filter((a) => addonIds.includes(a.id)) ?? [];

  return (
    <form action={action} className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-10">
        {/* 1. Package */}
        <section>
          <Step n={1} title="Choose a package" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {packages.map((pkg) => (
              <label
                key={pkg.id}
                className={`cursor-pointer border p-4 transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-brand/50 ${
                  packageId === pkg.id
                    ? "viewfinder border-brand bg-tint [--vf-color:var(--color-brand)] [--vf-inset:-6px]"
                    : "border-line bg-surface hover:border-brand/50"
                }`}
              >
                <input
                  type="radio"
                  name="package_choice"
                  className="sr-only"
                  checked={packageId === pkg.id}
                  onChange={() => choosePackage(pkg.id)}
                />
                <span className="caps text-muted">{pkg.category}</span>
                <span className="font-display mt-1 block text-lg font-semibold text-ink">
                  {pkg.name}
                </span>
                <span className="nums mt-2 flex items-baseline justify-between text-sm text-muted">
                  <span className="font-semibold text-ink">{formatPeso(pkg.price)}</span>
                  <span>{formatDuration(pkg.duration_minutes)}</span>
                </span>
              </label>
            ))}
          </div>
          <input type="hidden" name="package_id" value={packageId} />
        </section>

        {/* 2. Add-ons */}
        {selected && selected.addons.length > 0 ? (
          <section>
            <Step n={2} title="Add extras" optional />
            <div className="mt-4 flex flex-col gap-2">
              {selected.addons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex cursor-pointer items-center gap-3 border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-brand/50 has-checked:border-brand has-checked:bg-tint"
                >
                  <input
                    type="checkbox"
                    name="addon_ids"
                    value={addon.id}
                    checked={addonIds.includes(addon.id)}
                    onChange={(e) =>
                      setAddonIds((prev) =>
                        e.target.checked
                          ? [...prev, addon.id]
                          : prev.filter((id) => id !== addon.id),
                      )
                    }
                    className="size-4 accent-brand"
                  />
                  <span className="flex-1 text-sm text-ink">{addon.name}</span>
                  <span className="nums text-sm text-muted">+ {formatPeso(addon.price)}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {/* 3. Date and slot */}
        {selected ? (
          <section>
            <Step n={selected.addons.length > 0 ? 3 : 2} title="Pick a date and time" />
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="date" className="text-sm font-medium text-ink">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  min={today}
                  max={lastDate}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${inputClass} mt-1 max-w-xs sm:w-auto`}
                />
              </div>

              {date ? (
                loadingSlots ? (
                  <p className="text-sm text-muted">Checking what is free…</p>
                ) : slots && slots.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const active = slot?.starts_at === s.starts_at;
                      return (
                        <button
                          key={s.starts_at}
                          type="button"
                          onClick={() => setChosenSlotStart(s.starts_at)}
                          aria-pressed={active}
                          className={`nums press rounded-sm border px-4 py-2 text-sm ${
                            active
                              ? "border-action bg-action text-on-action"
                              : "border-line bg-surface text-ink hover:border-brand/50"
                          }`}
                        >
                          {formatManilaTime(s.starts_at)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Nothing free on that date. Try another day — the studio is closed on Sundays.
                  </p>
                )
              ) : null}

              {slot ? <input type="hidden" name="starts_at" value={slot.starts_at} /> : null}
            </div>
          </section>
        ) : null}

        {/* 4. Notes */}
        {slot ? (
          <section>
            <Step n={selected && selected.addons.length > 0 ? 4 : 3} title="Anything we should know?" optional />
            <textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Theme, number of people, special requests…"
              className={`${inputClass} mt-4`}
            />
          </section>
        ) : null}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-line bg-surface p-6">
          <h2 className="caps text-brand">Your booking</h2>

          {!selected ? (
            <p className="mt-4 text-sm text-muted">Choose a package to begin.</p>
          ) : (
            <>
              <p className="font-display mt-3 text-xl font-semibold text-ink">{selected.name}</p>
              <p className="caps mt-1 text-muted">
                {formatDuration(selected.duration_minutes)}
              </p>

              {slot ? (
                <p className="mt-4 border-t border-line pt-4 text-sm text-ink">
                  {formatManilaDate(slot.starts_at)}
                  <br />
                  <span className="nums text-muted">
                    {formatManilaTime(slot.starts_at)} – {formatManilaTime(slot.ends_at)}
                  </span>
                </p>
              ) : (
                <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
                  No time selected yet.
                </p>
              )}

              {quote ? (
                <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
                  <Row label="Package" value={formatPeso(quote.package_price)} />
                  {chosenAddons.map((a) => (
                    <Row key={a.id} label={a.name} value={`+ ${formatPeso(a.price)}`} muted />
                  ))}
                  {quote.discount_amount > 0 ? (
                    <Row
                      label={`Discount (${quote.discount_percent}%)`}
                      value={`− ${formatPeso(quote.discount_amount)}`}
                      highlight
                    />
                  ) : null}
                  <div className="flex items-baseline justify-between border-t border-line pt-2">
                    <dt className="font-medium text-ink">Total</dt>
                    <dd className="font-display nums text-xl font-semibold text-ink">
                      {formatPeso(quote.total_amount)}
                    </dd>
                  </div>
                </dl>
              ) : null}

              {state.message ? (
                <p role="alert" className="mt-4 rounded-sm bg-danger-tint px-3 py-2 text-sm text-danger">
                  {state.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!slot || pending}
                className="press mt-5 w-full rounded-full bg-action px-6 py-3 text-sm font-semibold text-on-action hover:bg-action-hover disabled:opacity-50"
              >
                {pending ? "Requesting…" : "Request this booking"}
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                Nothing is charged online. The studio confirms your slot, then you settle on the day.
              </p>
            </>
          )}
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, optional }: { n: number; title: string; optional?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-3">
      <span className="caps nums text-brand">{String(n).padStart(2, "0")}</span>
      <h2 className="text-2xl font-semibold text-heading">{title}</h2>
      {optional ? <span className="caps text-muted">Optional</span> : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-muted" : "text-ink"}>{label}</dt>
      <dd className={`nums ${highlight ? "text-brand" : muted ? "text-muted" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
