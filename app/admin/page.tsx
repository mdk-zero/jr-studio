import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getDashboard } from "@/lib/admin-dashboard";
import { shares } from "@/lib/dashboard-math";
import { ADMIN_STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";
import { formatManilaDate, formatManilaTime, formatMonth, formatMonthShort } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/bookings/badges";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_ORDER: BookingStatus[] = ["pending", "approved", "completed", "cancelled", "rejected", "expired"];

function Tile({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display nums mt-1 text-2xl font-semibold text-ink">{value}</dd>
      {note ? <dd className="mt-1 text-xs text-muted">{note}</dd> : null}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-xl border border-sand-300 bg-white p-4 transition hover:border-burgundy-300">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-sand-300 bg-white p-4">{body}</div>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireStaff("/admin");
  const d = await getDashboard();
  const monthName = formatMonth(d.month).split(" ")[0];
  const heights = shares(d.revenue.map((m) => m.net));
  const yearNet = d.revenue.reduce((sum, m) => sum + m.net, 0);
  const statusTotal = STATUS_ORDER.reduce((sum, s) => sum + d.statusCounts[s], 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Good to see you, ${user.fullName.split(" ")[0]}. ${formatMonth(d.month)}, in Manila time; money is from the payment ledger.`}
      />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tile
          label={`Received in ${monthName}`}
          value={formatPeso(d.current.net)}
          href="/admin/payments"
          note={
            d.netChange === null
              ? "Nothing received last month"
              : `${d.netChange >= 0 ? "▲" : "▼"} ${Math.abs(d.netChange)}% on last month`
          }
        />
        <Tile
          label="Still owed"
          value={formatPeso(d.outstanding)}
          note="On confirmed and completed sessions"
        />
        <Tile
          label={`Sessions in ${monthName}`}
          value={String(d.sessionsThisMonth)}
          note={d.statusCounts.pending ? `Plus ${d.statusCounts.pending} waiting for approval` : "Confirmed and completed"}
          href="/admin/bookings/calendar"
        />
        <Tile
          label="Waiting for approval"
          value={String(d.awaiting)}
          note={d.awaiting ? "Open the queue" : "All caught up"}
          href="/admin/bookings?status=pending"
        />
        <Tile label={`New customers in ${monthName}`} value={String(d.newCustomers)} href="/admin/customers?sort=newest" />
      </dl>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_20rem]">
        <Panel title="Revenue, last 12 months">
          <figure>
            <div className="flex h-48 items-end gap-1.5 sm:gap-2" aria-hidden="true">
              {d.revenue.map((m, i) => {
                const isCurrent = i === d.revenue.length - 1;
                return (
                  <div key={m.month} className="group relative flex h-full flex-1 flex-col justify-end">
                    <span className="nums pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white group-hover:block">
                      {formatPeso(m.net)}
                    </span>
                    <div
                      className={`w-full rounded-t ${isCurrent ? "bg-burgundy-600" : "bg-burgundy-300"} ${m.net > 0 ? "min-h-1" : ""}`}
                      style={{ height: `${heights[i] * 100}%` }}
                      title={`${formatMonth(m.month)}: ${formatPeso(m.net)}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden="true">
              {d.revenue.map((m) => (
                <span key={m.month} className="flex-1 text-center text-[11px] text-muted">
                  {formatMonthShort(m.month)}
                </span>
              ))}
            </div>
            <figcaption className="mt-3 text-sm text-muted">
              <span className="nums text-ink">{formatPeso(yearNet)}</span> received over 12 months, after refunds.
            </figcaption>
            {/* The same numbers for screen readers. */}
            <table className="sr-only">
              <caption>Net revenue by month</caption>
              <tbody>
                {d.revenue.map((m) => (
                  <tr key={m.month}>
                    <th scope="row">{formatMonth(m.month)}</th>
                    <td>{formatPeso(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </Panel>

        <Panel title={`${monthName} by status`}>
          {statusTotal === 0 ? (
            <p className="text-sm text-muted">No sessions this month yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5 text-sm">
              {STATUS_ORDER.filter((s) => d.statusCounts[s] > 0).map((s) => (
                <li key={s}>
                  <Link href={`/admin/bookings?status=${s}&when=all`} className="flex items-center justify-between gap-3 hover:text-burgundy-700">
                    <span className="text-ink">{ADMIN_STATUS_LABEL[s]}</span>
                    <span className="nums text-muted">{d.statusCounts[s]}</span>
                  </Link>
                  <div className="mt-1 h-1.5 rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-burgundy-400"
                      style={{ width: `${(d.statusCounts[s] / statusTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_20rem]">
        <Panel title="Coming up">
          {d.upcoming.length === 0 ? (
            <EmptyState>No upcoming sessions.</EmptyState>
          ) : (
            <ul className="divide-y divide-sand-200 text-sm">
              {d.upcoming.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-baseline gap-4">
                    <span className="nums w-28 shrink-0 text-ink">
                      {formatManilaDate(b.starts_at)}
                      <span className="block text-xs text-muted">{formatManilaTime(b.starts_at)}</span>
                    </span>
                    <span>
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium text-burgundy-700 hover:underline">
                        {b.customers?.full_name}
                      </Link>
                      <span className="block text-xs text-muted">
                        {b.packages?.name}
                        {b.staff_members ? ` · ${b.staff_members.full_name}` : " · no staff yet"}
                      </span>
                    </span>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/bookings/calendar" className="mt-3 inline-block text-sm text-burgundy-700 underline underline-offset-4">
            Open the calendar
          </Link>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Latest requests">
            {d.requests.length === 0 ? (
              <p className="text-sm text-muted">Nothing waiting.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {d.requests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/bookings/${r.id}`} className="font-medium text-burgundy-700 hover:underline">
                      {r.customers?.full_name}
                    </Link>
                    <span className="nums block text-xs text-muted">
                      {r.packages?.name} · {formatManilaDate(r.starts_at)}, {formatManilaTime(r.starts_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Top packages, 12 months">
            {d.topPackages.length === 0 ? (
              <p className="text-sm text-muted">No bookings yet.</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {d.topPackages.map((p, i) => (
                  <li key={p.name} className="flex items-baseline justify-between gap-3">
                    <span className="text-ink">
                      <span className="nums mr-2 text-muted">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="nums shrink-0 text-xs text-muted">
                      {p.count} booked · {formatPeso(p.value)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
