import {
  ADMIN_STATUS_LABEL,
  PAYMENT_COPY,
  STATUS_COPY,
  type BookingStatus,
} from "@/lib/booking-status";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_COPY[status].tone}`}>
      {ADMIN_STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string | null | undefined }) {
  const copy = status ? PAYMENT_COPY[status] : undefined;
  if (!copy) return null;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${copy.tone}`}>
      {copy.label}
    </span>
  );
}
