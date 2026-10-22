import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getLedger } from "@/lib/admin-bookings";
import { PAYMENT_METHOD_LABEL } from "@/lib/booking-status";
import { addMonths, formatManilaDate, formatManilaTime, formatMonth, manilaMonth } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { EmptyState, PageHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage(props: PageProps<"/admin/payments">) {
  await requireStaff("/admin/payments");
  const { month: monthParam } = await props.searchParams;

  const month =
    typeof monthParam === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : manilaMonth();
  const ledger = await getLedger(month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Payments · ${formatMonth(month)}`}
        description="Money recorded against bookings, by the date it was paid. Voided entries stay listed but do not count."
        action={
          <div className="flex gap-2 text-sm">
            <Link href={`/admin/payments?month=${addMonths(month, -1)}`} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
              ← {formatMonth(addMonths(month, -1)).split(" ")[0]}
            </Link>
            <Link href="/admin/payments" className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
              This month
            </Link>
            <Link href={`/admin/payments?month=${addMonths(month, 1)}`} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
              {formatMonth(addMonths(month, 1)).split(" ")[0]} →
            </Link>
          </div>
        }
      />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Received", value: ledger.received },
          { label: "Refunded", value: ledger.refunded },
          { label: "Net", value: ledger.net },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-sand-300 bg-white p-4">
            <dt className="text-xs font-medium tracking-wide text-muted uppercase">{tile.label}</dt>
            <dd className="font-display nums mt-1 text-2xl font-semibold text-ink">{formatPeso(tile.value)}</dd>
          </div>
        ))}
      </dl>

      {ledger.byMethod.length > 0 ? (
        <p className="text-sm text-muted">
          {ledger.byMethod.map(([method, total], i) => (
            <span key={method}>
              {i > 0 ? " · " : ""}
              {PAYMENT_METHOD_LABEL[method]} <span className="nums text-ink">{formatPeso(total)}</span>
            </span>
          ))}
        </p>
      ) : null}

      <Table
        head={
          <>
            <th>Paid</th>
            <th>Booking</th>
            <th>Method</th>
            <th>Recorded by</th>
            <th className="text-right">Amount</th>
          </>
        }
      >
        {ledger.rows.map((p) => (
          <tr key={p.id} className={p.voided_at ? "text-muted" : undefined}>
            <td className="nums whitespace-nowrap">
              {formatManilaDate(p.paid_at)}
              <span className="block text-xs text-muted">{formatManilaTime(p.paid_at)}</span>
            </td>
            <td>
              {p.bookings ? (
                <Link href={`/admin/bookings/${p.bookings.id}`} className="font-medium text-burgundy-700 hover:underline">
                  {p.bookings.reference}
                </Link>
              ) : null}
              <span className="block text-xs text-muted">{p.bookings?.customers?.full_name}</span>
            </td>
            <td>
              {PAYMENT_METHOD_LABEL[p.method]}
              {p.reference_no ? <span className="block text-xs text-muted">ref {p.reference_no}</span> : null}
            </td>
            <td className="text-muted">{p.recorder?.full_name ?? "—"}</td>
            <td className="nums text-right">
              <span className={p.voided_at ? "line-through" : p.amount < 0 ? "text-red-700" : "text-ink"}>
                {p.amount < 0 ? "− " : ""}
                {formatPeso(Math.abs(p.amount))}
              </span>
              {p.voided_at ? <span className="block text-xs">Voided: {p.void_reason}</span> : null}
            </td>
          </tr>
        ))}
      </Table>
      {ledger.rows.length === 0 ? <EmptyState>No payments recorded in {formatMonth(month)}.</EmptyState> : null}
    </div>
  );
}
