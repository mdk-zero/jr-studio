"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatManilaTime } from "@/lib/datetime";

export type Slot = { starts_at: string; ends_at: string };

/**
 * Open studio slots for a date and session length, from staff_available_slots:
 * business hours, blocked dates and existing bookings, but without the
 * customer-only lead time and advance limit.
 *
 * Results are cached by their inputs, so changing the date or duration yields
 * "not loaded yet" on its own and nothing is reset from an effect. `version`
 * joins the key for callers whose own writes change availability (moving a
 * booking frees one slot and takes another), so the next read is fresh.
 */
export function useStudioSlots(
  date: string,
  durationMinutes: number | null,
  excludeBookingId?: string,
  version = "",
) {
  const key = date && durationMinutes ? `${date}|${durationMinutes}|${excludeBookingId ?? ""}|${version}` : "";
  const [cache, setCache] = useState<Record<string, Slot[]>>({});
  const slots = key ? cache[key] : undefined;

  useEffect(() => {
    if (!key || cache[key] || !durationMinutes) return;
    let cancelled = false;

    createClient()
      .rpc("staff_available_slots", {
        p_date: date,
        p_duration_minutes: durationMinutes,
        p_exclude_booking_id: excludeBookingId,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [key]: error ? [] : (data ?? []) }));
      });

    return () => {
      cancelled = true;
    };
  }, [key, cache, date, durationMinutes, excludeBookingId]);

  return { slots, loading: Boolean(key) && slots === undefined };
}

export function SlotGrid({
  slots,
  loading,
  value,
  onSelect,
  hide,
}: {
  slots: Slot[] | undefined;
  loading: boolean;
  value: string | null;
  onSelect: (startsAt: string) => void;
  /** A start to leave out, e.g. the booking's current time when moving it. */
  hide?: string;
}) {
  if (loading) return <p className="text-sm text-muted">Checking the calendar…</p>;
  if (!slots) return null;

  const offered = slots.filter((s) => s.starts_at !== hide);
  if (offered.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing free that day. The studio may be closed, the date blocked, or every slot taken.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Available times">
      {offered.map((s) => {
        const active = value === s.starts_at;
        return (
          <button
            key={s.starts_at}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(s.starts_at)}
            className={`nums rounded-lg border px-3 py-1.5 text-sm transition ${
              active
                ? "border-burgundy-600 bg-burgundy-600 text-white"
                : "border-sand-300 bg-white text-ink hover:border-burgundy-400"
            }`}
          >
            {formatManilaTime(s.starts_at)}
          </button>
        );
      })}
    </div>
  );
}
