"use client";

import { useActionState, useState } from "react";
import {
  assignStaffAction,
  deleteBookingAction,
  rescheduleBookingAction,
  setBookingStatusAction,
} from "@/app/admin/bookings/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { SlotGrid, useStudioSlots } from "@/components/admin/bookings/studio-slots";
import type { StaffStatusAction } from "@/lib/booking-status";
import { formatManilaDate, formatManilaTime, manilaToday } from "@/lib/datetime";

const initial: ActionState = {};

const ACTION_COPY: Record<
  StaffStatusAction,
  { label: string; pending: string; primary: boolean; confirm?: string }
> = {
  approved: { label: "Approve", pending: "Approving…", primary: true },
  completed: { label: "Mark completed", pending: "Saving…", primary: true },
  rejected: {
    label: "Decline",
    pending: "Declining…",
    primary: false,
    confirm: "Decline this request? The customer sees it as declined.",
  },
  cancelled: {
    label: "Cancel booking",
    pending: "Cancelling…",
    primary: false,
    confirm: "Cancel this booking? This cannot be undone from here.",
  },
};

/** One form, one button per allowed change; the pressed button picks the status. */
export function StatusActions({
  bookingId,
  actions,
}: {
  bookingId: string;
  actions: StaffStatusAction[];
}) {
  const [state, action] = useActionState(setBookingStatusAction, initial);

  if (actions.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <ActionFeedback state={state} />
        <p className="text-sm text-muted">This booking is final. Its status cannot change any further.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label htmlFor="status-note" className="text-sm font-medium text-ink">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="status-note"
          name="note"
          rows={2}
          maxLength={500}
          placeholder="e.g. No crew available that day"
          className={`${adminInput} mt-1`}
        />
        <p className="mt-1 text-xs text-muted">Shown to the customer in their booking history.</p>
        <FieldError errors={state.errors?.note} />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => {
          const copy = ACTION_COPY[status];
          return (
            <SubmitButton
              key={status}
              name="status"
              value={status}
              quiet={!copy.primary}
              pendingLabel={copy.pending}
              confirm={copy.confirm}
              className={copy.primary ? "" : "px-4 py-2 text-sm"}
            >
              {copy.label}
            </SubmitButton>
          );
        })}
      </div>
    </form>
  );
}

export function RescheduleForm({
  bookingId,
  durationMinutes,
  currentStart,
}: {
  bookingId: string;
  durationMinutes: number;
  currentStart: string;
}) {
  const [state, action] = useActionState(rescheduleBookingAction, initial);
  const [date, setDate] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  // Keyed on the current start too: after a move, the cached grid is stale.
  const { slots, loading } = useStudioSlots(date, durationMinutes, bookingId, currentStart);

  // A choice only counts while the current list still offers it.
  const slot = slots?.find((s) => s.starts_at === chosen && s.starts_at !== currentStart) ?? null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label htmlFor="reschedule-date" className="text-sm font-medium text-ink">New date</label>
        <input
          id="reschedule-date"
          type="date"
          min={manilaToday()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${adminInput} mt-1`}
        />
      </div>
      {date ? (
        <SlotGrid slots={slots} loading={loading} value={slot?.starts_at ?? null} onSelect={setChosen} hide={currentStart} />
      ) : null}
      {slot ? (
        <>
          <input type="hidden" name="starts_at" value={slot.starts_at} />
          <p className="text-sm text-ink">
            Move to {formatManilaDate(slot.starts_at)}, {formatManilaTime(slot.starts_at)} –{" "}
            {formatManilaTime(slot.ends_at)}
          </p>
          <input name="note" maxLength={500} placeholder="Reason (optional, shown to the customer)" className={adminInput} />
          <div>
            <SubmitButton pendingLabel="Moving…">Move booking</SubmitButton>
          </div>
        </>
      ) : null}
      <FieldError errors={state.errors?.starts_at} />
    </form>
  );
}

export function AssignStaffForm({
  bookingId,
  current,
  options,
}: {
  bookingId: string;
  current: { id: string; full_name: string } | null;
  options: Array<{ id: string; full_name: string; position: string }>;
}) {
  const [state, action] = useActionState(assignStaffAction, initial);
  // Someone deactivated since the assignment still shows, so the select never
  // silently claims "Unassigned".
  const currentMissing = current && !options.some((o) => o.id === current.id);

  return (
    <form action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <label htmlFor="staff_id" className="sr-only">Assigned staff</label>
      <select
        id="staff_id"
        name="staff_id"
        defaultValue={current?.id ?? ""}
        key={current?.id ?? "none"}
        className={adminInput}
      >
        <option value="">Unassigned</option>
        {currentMissing ? (
          <option value={current.id} disabled>
            {current.full_name} (inactive)
          </option>
        ) : null}
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name} · {person.position.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <div>
        <SubmitButton quiet className="px-4 py-2 text-sm" pendingLabel="Saving…">
          Save assignment
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeleteBookingForm({ bookingId, reference }: { bookingId: string; reference: string }) {
  const [state, action] = useActionState(deleteBookingAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm text-muted">
        Only for bookings made in error. Bookings with payments on record cannot be deleted; cancel them instead.
      </p>
      <div>
        <SubmitButton
          quiet
          className="border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          pendingLabel="Deleting…"
          confirm={`Delete ${reference} and its history for good?`}
        >
          Delete booking
        </SubmitButton>
      </div>
    </form>
  );
}
