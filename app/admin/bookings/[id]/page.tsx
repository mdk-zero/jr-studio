import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getStaffBooking } from "@/lib/admin-bookings";
import { PAYMENT_METHOD_LABEL } from "@/lib/booking-status";
import { formatDuration, formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { Panel } from "@/components/admin/ui";
import { PaymentBadge, StatusBadge } from "@/components/admin/bookings/badges";
import {
  AssignStaffForm,
  DeleteBookingForm,
  RescheduleForm,
  StatusActions,
} from "@/components/admin/bookings/booking-controls";
import { RecordPaymentForm, VoidPaymentForm } from "@/components/admin/bookings/payment-forms";

export const metadata: Metadata = { title: "Booking" };

export default async function AdminBookingPage(props: PageProps<"/admin/bookings/[id]">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const { created } = await props.searchParams;

  // A malformed id would only produce a Postgres cast error; treat it as missing.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const booking = await getStaffBooking(id);
  if (!booking) notFound();

  const isAdmin = user.role === "admin";
  const paid = Number(booking.summary.paid_total ?? 0);
  const balance = Number(booking.summary.balance ?? booking.total_amount);

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/bookings" className="hover:text-ink">Bookings</Link>
        <span className="mx-2 text-sand-400">/</span>
        <span className="text-ink">{booking.reference}</span>
      </nav>

      {created ? (
        <p role="status" className="rounded-lg bg-burgundy-50 px-4 py-3 text-sm text-burgundy-700">
          Booked and approved. Record a deposit below if one was paid.
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-sand-300 pb-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {booking.reference} · {booking.source === "admin" ? "Studio booking" : "Online request"}
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold text-burgundy-700">
            {booking.packages?.name ?? "Session"}
          </h1>
          <p className="nums mt-1 text-ink">
            {formatManilaDate(booking.starts_at)}, {formatManilaTime(booking.starts_at)} –{" "}
            {formatManilaTime(booking.ends_at)}
            <span className="text-muted"> ({formatDuration(booking.durationMinutes)})</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={booking.status} />
          <PaymentBadge status={booking.summary.payment_status} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Panel title="Customer">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Name</dt>
                <dd className="text-ink">{booking.customers?.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Account</dt>
                <dd className="text-ink">{booking.customers?.profile_id ? "Signed up" : "Walk-in (no login)"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Email</dt>
                <dd className="break-all text-ink">
                  {booking.customers?.email ? (
                    <a href={`mailto:${booking.customers.email}`} className="hover:underline">{booking.customers.email}</a>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Mobile</dt>
                <dd className="nums text-ink">
                  {booking.customers?.phone ? (
                    <a href={`tel:${booking.customers.phone}`} className="hover:underline">{booking.customers.phone}</a>
                  ) : "—"}
                </dd>
              </div>
            </dl>
            {booking.notes ? (
              <div className="mt-4 rounded-lg bg-sand-50 px-4 py-3 text-sm">
                <p className="text-xs font-medium text-muted">
                  {booking.source === "customer" ? "Customer's note" : "Booking note"}
                </p>
                <p className="mt-1 whitespace-pre-line text-ink">{booking.notes}</p>
              </div>
            ) : null}
          </Panel>

          <Panel title="Price">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink">{booking.packages?.name}</dt>
                <dd className="nums">{formatPeso(booking.package_price)}</dd>
              </div>
              {booking.addons.map((line, i) => (
                <div key={i} className="flex justify-between gap-4 text-muted">
                  <dt>
                    {line.addons?.name}
                    {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                  </dt>
                  <dd className="nums">+ {formatPeso(line.unit_price * line.quantity)}</dd>
                </div>
              ))}
              {booking.discount_amount > 0 ? (
                <div className="flex justify-between gap-4 text-burgundy-700">
                  <dt>Promotion</dt>
                  <dd className="nums">− {formatPeso(booking.discount_amount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-sand-200 pt-2 font-semibold text-ink">
                <dt>Total</dt>
                <dd className="nums">{formatPeso(booking.total_amount)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-muted">
                <dt>Paid</dt>
                <dd className="nums">{formatPeso(paid)}</dd>
              </div>
              {/* Nothing is owed on a cancelled, declined or expired booking. */}
              {booking.payable ? (
                <div className="flex justify-between gap-4 text-ink">
                  <dt>Balance</dt>
                  <dd className="nums font-medium">{formatPeso(balance)}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Payments">
            {booking.payments.length > 0 ? (
              <ul className="mb-5 divide-y divide-sand-200 text-sm">
                {booking.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className={p.voided_at ? "text-muted line-through decoration-sand-400" : ""}>
                      <p className="nums font-medium text-ink">
                        {p.amount < 0 ? "Refund " : ""}
                        {formatPeso(Math.abs(p.amount))}
                        <span className="font-normal text-muted"> · {PAYMENT_METHOD_LABEL[p.method]}</span>
                      </p>
                      <p className="nums text-xs text-muted">
                        {formatManilaDate(p.paid_at)}, {formatManilaTime(p.paid_at)}
                        {p.reference_no ? ` · ref ${p.reference_no}` : ""}
                        {p.recorder?.full_name ? ` · by ${p.recorder.full_name}` : ""}
                      </p>
                      {p.note ? <p className="text-xs text-muted">{p.note}</p> : null}
                    </div>
                    {p.voided_at ? (
                      <p className="max-w-56 text-right text-xs text-muted">
                        Voided{p.voider?.full_name ? ` by ${p.voider.full_name}` : ""}: {p.void_reason}
                      </p>
                    ) : isAdmin ? (
                      <VoidPaymentForm bookingId={booking.id} paymentId={p.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-muted">Nothing recorded yet.</p>
            )}
            <RecordPaymentForm
              bookingId={booking.id}
              balance={balance}
              paidTotal={paid}
              canPay={booking.payable}
            />
          </Panel>

          <Panel title="History">
            <ol className="space-y-3">
              {booking.events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="nums w-36 shrink-0 text-xs text-muted">
                    {formatManilaDate(event.created_at)}
                    <br />
                    {formatManilaTime(event.created_at)}
                  </span>
                  <span className="text-ink">
                    {event.note ?? event.type.replace(/_/g, " ")}
                    <span className="block text-xs text-muted">
                      {event.profiles?.full_name ?? (event.type === "expired" ? "Automatic" : "System")}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Status">
            <StatusActions bookingId={booking.id} actions={booking.statusActions} />
          </Panel>

          {booking.reschedulable ? (
            <Panel title="Reschedule">
              <RescheduleForm
                bookingId={booking.id}
                durationMinutes={booking.durationMinutes}
                currentStart={booking.starts_at}
              />
            </Panel>
          ) : null}

          {["pending", "approved", "completed"].includes(booking.status) ? (
            <Panel title="Staff">
              <AssignStaffForm
                bookingId={booking.id}
                current={booking.staff_members}
                options={booking.staffOptions}
              />
            </Panel>
          ) : booking.staff_members ? (
            <Panel title="Staff">
              <p className="text-sm text-ink">{booking.staff_members.full_name}</p>
            </Panel>
          ) : null}

          {isAdmin ? (
            <Panel title="Delete">
              <DeleteBookingForm bookingId={booking.id} reference={booking.reference} />
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
