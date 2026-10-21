"use client";

import { useActionState, useState } from "react";
import { recordPaymentAction, voidPaymentAction } from "@/app/admin/bookings/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from "@/lib/booking-status";
import { formatPeso } from "@/lib/money";

const initial: ActionState = {};

/**
 * Money in, or a refund out. Refunds are negative entries in the same ledger;
 * the sign is set on the server from `kind`, so nobody types a minus sign.
 */
export function RecordPaymentForm({
  bookingId,
  balance,
  paidTotal,
  canPay,
}: {
  bookingId: string;
  balance: number;
  paidTotal: number;
  /** False once the booking is cancelled, rejected or expired. */
  canPay: boolean;
}) {
  const [state, action] = useActionState(recordPaymentAction, initial);
  const paymentOpen = canPay && balance > 0;
  const refundOpen = paidTotal > 0;
  const [kind, setKind] = useState<"payment" | "refund">(paymentOpen ? "payment" : "refund");

  if (!paymentOpen && !refundOpen) {
    // Often reached by the entry just recorded (the last payment, the full
    // refund), so its confirmation still shows here.
    return (
      <div className="flex flex-col gap-3">
        <ActionFeedback state={state} />
        <p className="text-sm text-muted">
          {canPay ? "Paid in full. Nothing left to record." : "No payments to refund."}
        </p>
      </div>
    );
  }

  const effectiveKind = kind === "payment" && !paymentOpen ? "refund" : kind === "refund" && !refundOpen ? "payment" : kind;
  const limit = effectiveKind === "payment" ? balance : paidTotal;

  return (
    <form action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="kind" value={effectiveKind} />

      <div className="flex gap-1 rounded-lg bg-sand-100 p-1" role="radiogroup" aria-label="Entry type">
        {(["payment", "refund"] as const).map((option) => {
          const enabled = option === "payment" ? paymentOpen : refundOpen;
          const active = effectiveKind === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!enabled}
              onClick={() => setKind(option)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {option === "payment" ? "Payment received" : "Refund given"}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className="text-sm font-medium text-ink">Amount (₱)</label>
          <input
            // Remounts when the entry type or balance changes, so the prefill is
            // never a stale balance or a refund amount. Only the input remounts;
            // the form keeps its action state, so the confirmation stays visible.
            key={`${effectiveKind}|${limit}`}
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            defaultValue={effectiveKind === "payment" ? limit.toFixed(2) : ""}
            className={`${adminInput} nums mt-1`}
          />
          <FieldError errors={state.errors?.amount} />
        </div>
        <div>
          <label htmlFor="method" className="text-sm font-medium text-ink">Method</label>
          <select id="method" name="method" defaultValue="cash" className={`${adminInput} mt-1`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-1 text-xs text-muted">
        {effectiveKind === "payment" ? `Up to ${formatPeso(limit)} still owed.` : `Up to ${formatPeso(limit)} paid so far.`}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="reference_no" className="text-sm font-medium text-ink">Reference no.</label>
          <input id="reference_no" name="reference_no" maxLength={100} placeholder="GCash / bank ref" className={`${adminInput} mt-1`} />
        </div>
        <div>
          <label htmlFor="paid_at" className="text-sm font-medium text-ink">When</label>
          <input id="paid_at" name="paid_at" type="datetime-local" className={`${adminInput} nums mt-1`} />
          <FieldError errors={state.errors?.paid_at} />
        </div>
      </div>
      <p className="-mt-1 text-xs text-muted">Leave “When” empty for right now (Manila time).</p>

      <div>
        <label htmlFor="payment-note" className="text-sm font-medium text-ink">
          Note <span className="font-normal text-muted">(optional, staff only)</span>
        </label>
        <input id="payment-note" name="note" maxLength={300} className={`${adminInput} mt-1`} />
      </div>

      <div>
        <SubmitButton pendingLabel="Recording…">
          {effectiveKind === "payment" ? "Record payment" : "Record refund"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Admin only. Voiding keeps the row and its reason; it just stops counting. */
export function VoidPaymentForm({ bookingId, paymentId }: { bookingId: string; paymentId: string }) {
  const [state, action] = useActionState(voidPaymentAction, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-muted underline-offset-4 hover:text-red-700 hover:underline"
      >
        Void
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <ActionFeedback state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="payment_id" value={paymentId} />
      <label htmlFor={`void-${paymentId}`} className="sr-only">Reason for voiding</label>
      <input
        id={`void-${paymentId}`}
        name="reason"
        required
        minLength={3}
        maxLength={300}
        placeholder="Why void it?"
        className={`${adminInput} w-48 py-1 text-xs`}
      />
      <FieldError errors={state.errors?.reason} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">
          Keep
        </button>
        <SubmitButton quiet pendingLabel="…" className="text-red-700">
          Void payment
        </SubmitButton>
      </div>
    </form>
  );
}
