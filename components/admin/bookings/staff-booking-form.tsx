"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createStaffBookingAction } from "@/app/admin/bookings/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminButton, adminInput } from "@/components/admin/form-controls";
import { Panel } from "@/components/admin/ui";
import { SlotGrid, useStudioSlots } from "@/components/admin/bookings/studio-slots";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatManilaDate, formatManilaTime, manilaToday } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";

type Pkg = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string;
  addons: Array<{ id: string; name: string; price: number }>;
};

type Customer = { id: string; full_name: string; email: string | null; phone: string | null };

type Quote = { addons_total: number; discount_percent: number | null; discount_amount: number; total_amount: number };

const initial: ActionState = {};

/** Same character whitelist the server applies before an or=() filter. */
function searchTerm(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s@.+-]/gu, "").trim();
}

/**
 * A booking made by the studio: walk-ins, phone and Messenger requests. It is
 * approved on creation, and the price comes from quote_booking like any other.
 */
export function StaffBookingForm({
  packages,
  staff,
}: {
  packages: Pkg[];
  staff: Array<{ id: string; full_name: string }>;
}) {
  const [state, action] = useActionState(createStaffBookingAction, initial);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searchCache, setSearchCache] = useState<Record<string, Customer[]>>({});

  const [packageId, setPackageId] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [quoteCache, setQuoteCache] = useState<Record<string, Quote>>({});

  const selected = useMemo(() => packages.find((p) => p.id === packageId) ?? null, [packages, packageId]);
  const { slots, loading } = useStudioSlots(date, selected?.duration_minutes ?? null);
  const slot = slots?.find((s) => s.starts_at === chosen) ?? null;

  // Debounced so typing a name is one query, not one per keystroke. The state
  // update happens in the timer, not synchronously in the effect.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(searchTerm(query)), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const results = term.length >= 2 ? searchCache[term] : undefined;

  useEffect(() => {
    if (term.length < 2 || searchCache[term]) return;
    let cancelled = false;
    createClient()
      .from("customers")
      .select("id, full_name, email, phone")
      .eq("status", "active")
      .or(`full_name.ilike."%${term}%",email.ilike."%${term}%",phone.ilike."%${term}%"`)
      .order("full_name")
      .limit(8)
      .then(({ data }) => {
        if (!cancelled) setSearchCache((prev) => ({ ...prev, [term]: data ?? [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [term, searchCache]);

  const quoteKey = packageId ? `${packageId}|${[...addonIds].sort().join(",")}` : "";
  const quote = quoteKey ? quoteCache[quoteKey] : undefined;

  useEffect(() => {
    if (!quoteKey || quoteCache[quoteKey]) return;
    let cancelled = false;
    createClient()
      .rpc("quote_booking", { p_package_id: packageId, p_addon_ids: addonIds })
      .then(({ data, error }) => {
        const row = data?.[0];
        if (cancelled || error || !row) return;
        setQuoteCache((prev) => ({
          ...prev,
          [quoteKey]: {
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

  function choosePackage(id: string) {
    setPackageId(id);
    setAddonIds([]);
  }

  const customerReady = mode === "new" || Boolean(customer);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <Panel title="Customer">
          <input type="hidden" name="customer_mode" value={mode} />
          <div className="mb-4 flex gap-1 rounded-lg bg-sand-100 p-1" role="radiogroup" aria-label="Customer">
            {(["existing", "new"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => setMode(option)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  mode === option ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {option === "existing" ? "Existing customer" : "New walk-in"}
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            customer ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-burgundy-200 bg-burgundy-50 px-4 py-3">
                <input type="hidden" name="customer_id" value={customer.id} />
                <div className="text-sm">
                  <p className="font-medium text-ink">{customer.full_name}</p>
                  <p className="text-muted">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                </div>
                <button type="button" onClick={() => setCustomer(null)} className="text-xs font-medium text-burgundy-700 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <div>
                <label htmlFor="customer-search" className="text-sm font-medium text-ink">Search by name, email or phone</label>
                <input
                  id="customer-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. Andrea or 0917…"
                  className={`${adminInput} mt-1`}
                />
                {results ? (
                  results.length > 0 ? (
                    <ul className="mt-2 divide-y divide-sand-200 rounded-lg border border-sand-300">
                      {results.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setCustomer(c)}
                            className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-sand-50"
                          >
                            <span className="font-medium text-ink">{c.full_name}</span>
                            <span className="text-xs text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      No match.{" "}
                      <button type="button" onClick={() => setMode("new")} className="font-medium text-burgundy-700 hover:underline">
                        Add them as a walk-in
                      </button>
                    </p>
                  )
                ) : null}
                <FieldError errors={state.errors?.customer_id} />
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="customer_name" className="text-sm font-medium text-ink">Full name</label>
                <input id="customer_name" name="customer_name" maxLength={100} className={`${adminInput} mt-1`} />
                <FieldError errors={state.errors?.customer_name} />
              </div>
              <div>
                <label htmlFor="customer_phone" className="text-sm font-medium text-ink">Mobile</label>
                <input id="customer_phone" name="customer_phone" inputMode="tel" placeholder="09171234567" className={`${adminInput} mt-1`} />
                <FieldError errors={state.errors?.customer_phone} />
              </div>
              <div>
                <label htmlFor="customer_email" className="text-sm font-medium text-ink">Email</label>
                <input id="customer_email" name="customer_email" type="email" className={`${adminInput} mt-1`} />
                <FieldError errors={state.errors?.customer_email} />
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                With an email, their history joins their account if they sign up with it later.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Package">
          <input type="hidden" name="package_id" value={packageId} />
          <label htmlFor="package" className="sr-only">Package</label>
          <select id="package" value={packageId} onChange={(e) => choosePackage(e.target.value)} className={adminInput}>
            <option value="">Choose a package…</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} · {formatPeso(pkg.price)} · {formatDuration(pkg.duration_minutes)}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.package_id} />

          {selected && selected.addons.length > 0 ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-ink">Add-ons</legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {selected.addons.map((addon) => (
                  <label key={addon.id} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="addon_ids"
                      value={addon.id}
                      checked={addonIds.includes(addon.id)}
                      onChange={(e) =>
                        setAddonIds((prev) =>
                          e.target.checked ? [...prev, addon.id] : prev.filter((id) => id !== addon.id),
                        )
                      }
                      className="size-4 accent-burgundy-600"
                    />
                    <span className="flex-1">{addon.name}</span>
                    <span className="nums text-muted">+ {formatPeso(addon.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </Panel>

        <Panel title="Date and time">
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="date" className="text-sm font-medium text-ink">Date</label>
                <input
                  id="date"
                  type="date"
                  min={manilaToday()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${adminInput} mt-1 sm:w-auto`}
                />
                <p className="mt-1 text-xs text-muted">
                  The studio can book inside the customer lead time, including a session already running today.
                </p>
              </div>
              {date ? <SlotGrid slots={slots} loading={loading} value={slot?.starts_at ?? null} onSelect={setChosen} /> : null}
              {slot ? <input type="hidden" name="starts_at" value={slot.starts_at} /> : null}
              <FieldError errors={state.errors?.starts_at} />
            </div>
          ) : (
            <p className="text-sm text-muted">Choose a package first; its length decides which times fit.</p>
          )}
        </Panel>

        <Panel title="Staff and notes">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="staff_id" className="text-sm font-medium text-ink">Assign to</label>
              <select id="staff_id" name="staff_id" defaultValue="" className={`${adminInput} mt-1`}>
                <option value="">Decide later</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>{person.full_name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className="text-sm font-medium text-ink">Notes</label>
              <textarea id="notes" name="notes" rows={2} maxLength={1000} className={`${adminInput} mt-1`} />
              <p className="mt-1 text-xs text-muted">Visible to the customer if they have an account.</p>
            </div>
          </div>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Panel title="Summary">
          <div className="flex flex-col gap-3 text-sm">
            <ActionFeedback state={state} />
            <p className="text-ink">
              {mode === "new" ? "New walk-in" : (customer?.full_name ?? <span className="text-muted">No customer yet</span>)}
            </p>
            {selected ? (
              <p className="text-ink">
                {selected.name} <span className="text-muted">· {formatDuration(selected.duration_minutes)}</span>
              </p>
            ) : null}
            {slot ? (
              <p className="nums text-ink">
                {formatManilaDate(slot.starts_at)}
                <br />
                <span className="text-muted">{formatManilaTime(slot.starts_at)} – {formatManilaTime(slot.ends_at)}</span>
              </p>
            ) : null}
            {selected && quote ? (
              <dl className="space-y-1 border-t border-sand-200 pt-3">
                <div className="flex justify-between"><dt className="text-muted">Package</dt><dd className="nums">{formatPeso(selected.price)}</dd></div>
                {quote.addons_total > 0 ? (
                  <div className="flex justify-between"><dt className="text-muted">Add-ons</dt><dd className="nums">+ {formatPeso(quote.addons_total)}</dd></div>
                ) : null}
                {quote.discount_amount > 0 ? (
                  <div className="flex justify-between text-burgundy-700">
                    <dt>Promotion ({quote.discount_percent}%)</dt>
                    <dd className="nums">− {formatPeso(quote.discount_amount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-sand-200 pt-2 font-semibold">
                  <dt>Total</dt><dd className="nums">{formatPeso(quote.total_amount)}</dd>
                </div>
              </dl>
            ) : null}
            {customerReady && slot ? (
              <SubmitButton pendingLabel="Booking…" className="w-full">
                Book and approve
              </SubmitButton>
            ) : (
              <>
                <button type="button" disabled className={`${adminButton} w-full`}>
                  Book and approve
                </button>
                <p className="text-xs text-muted">
                  {!customerReady ? "Choose a customer" : "Pick a time"} to finish.
                </p>
              </>
            )}
            <p className="text-xs text-muted">Studio bookings are approved straight away.</p>
          </div>
        </Panel>
      </aside>
    </form>
  );
}
