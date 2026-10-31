"use client";

import { useActionState, useEffect, useState } from "react";
import {
  cancelBookingAction,
  undoCancelBookingAction,
  type AccountState,
} from "@/app/(account)/account/actions";

const initial: AccountState = {};

/**
 * Cancel, with an undo window.
 *
 * The window is server state (bookings.cancelled_at + the studio setting), not
 * a timer held in the page — the legacy undo lived in a PHP session, so it was
 * lost on logout or on another device. The countdown here is only a display of
 * what the server will still accept.
 */
export function BookingActions({
  bookingId,
  status,
  cancellable,
  cancelledAt,
  undoWindowSeconds,
  cancelCutoffHours,
}: {
  bookingId: string;
  status: string;
  cancellable: boolean;
  cancelledAt: string | null;
  undoWindowSeconds: number;
  cancelCutoffHours: number;
}) {
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelBookingAction, initial);
  const [undoState, undoAction, undoPending] = useActionState(undoCancelBookingAction, initial);
  // Which button was used last decides which result to show. Both results
  // persist, and the cancel result used to win even after a successful undo.
  const [last, setLast] = useState<"cancel" | "undo" | null>(null);

  // Cancelled or not comes from the booking itself: both actions refresh this
  // page in the same response, so the props are never behind. (Deriving it
  // from the cancel result kept showing "cancelled" after an undo.)
  const isCancelled = status === "cancelled";

  // The deadline is server state. Only the clock lives in React state, ticked
  // by the interval, so nothing is set synchronously during an effect.
  const deadline =
    isCancelled && cancelledAt
      ? new Date(cancelledAt).getTime() + undoWindowSeconds * 1000
      : 0;

  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const secondsLeft = deadline ? Math.max(0, Math.round((deadline - nowTs) / 1000)) : 0;

  const shown = last === "undo" ? undoState : last === "cancel" ? cancelState : initial;
  const message = shown.message;
  const isError = Boolean(shown.message && !shown.ok);

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p
          role={isError ? "alert" : "status"}
          className={
            isError
              ? "rounded-sm bg-danger-tint px-3 py-2 text-sm text-danger"
              : "rounded-sm bg-tint px-3 py-2 text-sm text-on-tint"
          }
        >
          {message}
        </p>
      ) : null}

      {cancellable ? (
        <form action={cancelAction} onSubmit={() => setLast("cancel")}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <button
            type="submit"
            disabled={cancelPending}
            onClick={(event) => {
              if (!window.confirm("Cancel this booking? You have a few minutes to undo.")) {
                event.preventDefault();
              }
            }}
            className="press rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60"
          >
            {cancelPending ? "Cancelling…" : "Cancel booking"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Cancellations close {cancelCutoffHours} hours before the session.
          </p>
        </form>
      ) : null}

      {isCancelled && secondsLeft > 0 ? (
        <form action={undoAction} onSubmit={() => setLast("undo")}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <button
            type="submit"
            disabled={undoPending}
            className="press rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-action hover:bg-action-hover disabled:opacity-60"
          >
            {undoPending ? "Restoring…" : `Undo cancellation (${secondsLeft}s)`}
          </button>
          <p className="mt-2 text-xs text-muted">
            Only if the slot is still free.
          </p>
        </form>
      ) : null}
    </div>
  );
}
