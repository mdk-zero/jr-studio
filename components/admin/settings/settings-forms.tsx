"use client";

import { useActionState, useState } from "react";
import {
  addBlockedDateAction,
  saveBookingRulesAction,
  saveBusinessHoursAction,
  saveStudioDetailsAction,
} from "@/app/admin/settings/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: ActionState = {};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Input({
  label,
  name,
  defaultValue,
  errors,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  errors?: string[];
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-ink">{label}</label>
      <input id={name} name={name} defaultValue={defaultValue ?? ""} className={`${adminInput} mt-1`} {...rest} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      <FieldError errors={errors} />
    </div>
  );
}

export function StudioDetailsForm({
  settings,
}: {
  settings: {
    studio_name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    map_url: string | null;
    socials: Record<string, string>;
  };
}) {
  const [state, action] = useActionState(saveStudioDetailsAction, initial);
  const memory = useFormMemory(state);
  const e = state.errors ?? {};

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4">
      <ActionFeedback state={state} />
      <Input label="Studio name" name="studio_name" defaultValue={memory.text("studio_name", settings.studio_name)} required errors={e.studio_name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Phone" name="phone" defaultValue={memory.text("phone", settings.phone)} inputMode="tel" errors={e.phone} />
        <Input label="Public email" name="email" type="email" defaultValue={memory.text("email", settings.email)} errors={e.email} hint="Shown in the footer. Leave empty to hide it." />
      </div>
      <Input label="Address" name="address" defaultValue={memory.text("address", settings.address)} errors={e.address} />
      <Input label="Map link" name="map_url" type="url" defaultValue={memory.text("map_url", settings.map_url)} placeholder="https://maps.google.com/…" errors={e.map_url} />
      <div className="flex flex-col gap-4">
        <Input label="Facebook" name="facebook" type="url" defaultValue={memory.text("facebook", settings.socials.facebook)} errors={e.facebook} />
        <Input label="Instagram" name="instagram" type="url" defaultValue={memory.text("instagram", settings.socials.instagram)} errors={e.instagram} />
        <Input label="TikTok" name="tiktok" type="url" defaultValue={memory.text("tiktok", settings.socials.tiktok)} errors={e.tiktok} />
      </div>
      <div>
        <SubmitButton>Save details</SubmitButton>
      </div>
    </form>
  );
}

export function BookingRulesForm({
  rules,
}: {
  rules: {
    slot_interval_minutes: number;
    min_lead_hours: number;
    max_advance_days: number;
    cancel_cutoff_hours: number;
    undo_window_seconds: number;
  };
}) {
  const [state, action] = useActionState(saveBookingRulesAction, initial);
  const memory = useFormMemory(state);
  const e = state.errors ?? {};

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4">
      <ActionFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Start times every (minutes)" name="slot_interval_minutes" type="number" min={5} max={240} defaultValue={memory.text("slot_interval_minutes", rules.slot_interval_minutes)} errors={e.slot_interval_minutes} hint="60 offers 9:00, 10:00, 11:00…" />
        <Input label="Book at least (hours ahead)" name="min_lead_hours" type="number" min={0} max={720} defaultValue={memory.text("min_lead_hours", rules.min_lead_hours)} errors={e.min_lead_hours} hint="Online requests only. The studio can book any free slot." />
        <Input label="Book at most (days ahead)" name="max_advance_days" type="number" min={1} max={730} defaultValue={memory.text("max_advance_days", rules.max_advance_days)} errors={e.max_advance_days} />
        <Input label="Customers can cancel until (hours before)" name="cancel_cutoff_hours" type="number" min={0} max={720} defaultValue={memory.text("cancel_cutoff_hours", rules.cancel_cutoff_hours)} errors={e.cancel_cutoff_hours} />
        <Input label="Undo a cancellation within (seconds)" name="undo_window_seconds" type="number" min={0} max={3600} defaultValue={memory.text("undo_window_seconds", rules.undo_window_seconds)} errors={e.undo_window_seconds} />
      </div>
      <div>
        <SubmitButton>Save rules</SubmitButton>
      </div>
    </form>
  );
}

export function BusinessHoursForm({
  hours,
}: {
  hours: Array<{ weekday: number; is_open: boolean; opens_at: string; closes_at: string }>;
}) {
  const [state, action] = useActionState(saveBusinessHoursAction, initial);
  const memory = useFormMemory(state);
  const [open, setOpen] = useState(() => Object.fromEntries(hours.map((h) => [h.weekday, h.is_open])));

  // Each day is a fixed grid row, so the days line up and the time boxes keep their width.
  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      {hours.map((h) => (
        <div key={h.weekday} className="grid grid-cols-[6.5rem_1fr_auto_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[8rem_9rem_auto_9rem]">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name={`is_open_${h.weekday}`}
              checked={open[h.weekday]}
              onChange={(e) => setOpen((prev) => ({ ...prev, [h.weekday]: e.target.checked }))}
              className="size-4 accent-burgundy-600"
            />
            {DAYS[h.weekday]}
          </label>
          {open[h.weekday] ? (
            <>
              <input type="time" name={`opens_at_${h.weekday}`} defaultValue={memory.text(`opens_at_${h.weekday}`, h.opens_at.slice(0, 5))} aria-label={`${DAYS[h.weekday]} opens`} className={`${adminInput} nums`} />
              <span className="text-muted">to</span>
              <input type="time" name={`closes_at_${h.weekday}`} defaultValue={memory.text(`closes_at_${h.weekday}`, h.closes_at.slice(0, 5))} aria-label={`${DAYS[h.weekday]} closes`} className={`${adminInput} nums`} />
              {state.errors?.[`closes_at_${h.weekday}`] ? (
                <div className="col-span-3 col-start-2">
                  <FieldError errors={state.errors[`closes_at_${h.weekday}`]} />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Closed days keep their times, so reopening restores them. */}
              <input type="hidden" name={`opens_at_${h.weekday}`} value={h.opens_at.slice(0, 5)} />
              <input type="hidden" name={`closes_at_${h.weekday}`} value={h.closes_at.slice(0, 5)} />
              <span className="col-span-3 text-sm text-muted">Closed</span>
            </>
          )}
        </div>
      ))}
      <p className="text-xs text-muted">A session must finish by closing time, so the last start time depends on its length.</p>
      <div>
        <SubmitButton>Save hours</SubmitButton>
      </div>
    </form>
  );
}

export function BlockedDateForm({ today }: { today: string }) {
  const [state, action] = useActionState(addBlockedDateAction, initial);
  const memory = useFormMemory(state);

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="blocked_on" className="text-xs font-medium text-muted">Date</label>
          <input id="blocked_on" name="blocked_on" type="date" min={today} required defaultValue={memory.text("blocked_on")} className={`${adminInput} mt-1 w-auto`} />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="reason" className="text-xs font-medium text-muted">Reason (optional)</label>
          <input id="reason" name="reason" maxLength={120} defaultValue={memory.text("reason")} placeholder="e.g. Holiday, studio shoot" className={`${adminInput} mt-1`} />
        </div>
        <SubmitButton quiet className="px-4 py-2 text-sm">Close this day</SubmitButton>
      </div>
      <FieldError errors={state.errors?.blocked_on} />
    </form>
  );
}
