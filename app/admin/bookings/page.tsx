import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { countAwaitingApproval, listBookings } from "@/lib/admin-bookings";
import { bookingListSchema } from "@/lib/validators/admin-booking";
import { ADMIN_STATUS_LABEL } from "@/lib/booking-status";
import { formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { EmptyState, PageHeader, Table } from "@/components/admin/ui";
import { adminButton, adminInput } from "@/components/admin/styles";
import { PaymentBadge, StatusBadge } from "@/components/admin/bookings/badges";

export const metadata: Metadata = { title: "Bookings" };

const STATUS_OPTIONS = ["all", "pending", "approved", "completed", "cancelled", "rejected", "expired"] as const;

export default async function AdminBookingsPage(props: PageProps<"/admin/bookings">) {
  await requireStaff("/admin/bookings");
  const raw = await props.searchParams;
  const filters = bookingListSchema.parse({
    status: raw.status,
    when: raw.when,
    q: raw.q,
    page: raw.page,
  });

  const [{ rows, total, page, pageCount }, awaiting] = await Promise.all([
    listBookings(filters),
    countAwaitingApproval(),
  ]);

  // A page number past the end (an old link, a hand-edited URL) comes back empty.
  const pastEnd = rows.length === 0 && page > 1;

  const hrefFor = (overrides: Partial<typeof filters>) => {
    const next = { ...filters, ...overrides };
    const params = new URLSearchParams();
    if (next.status !== "all") params.set("status", next.status);
    if (next.when !== "upcoming") params.set("when", next.when);
    if (next.q) params.set("q", next.q);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    return query ? `/admin/bookings?${query}` : "/admin/bookings";
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bookings"
        description="Every session, online requests and studio bookings alike. Times are Manila time."
        action={
          awaiting > 0 ? (
            <Link
              href={hrefFor({ status: "pending", when: "upcoming", q: "", page: 1 })}
              className="rounded-full bg-burgundy-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-700"
            >
              {awaiting} waiting for approval
            </Link>
          ) : null
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="when" className="block text-xs font-medium text-muted">When</label>
          <select id="when" name="when" defaultValue={filters.when} className={`${adminInput} mt-1 w-auto`}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All dates</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted">Status</label>
          <select id="status" name="status" defaultValue={filters.status} className={`${adminInput} mt-1 w-auto`}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "all" ? "Any status" : ADMIN_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-muted">Search</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Reference, customer name, email or phone"
            className={`${adminInput} mt-1`}
          />
        </div>
        <button type="submit" className={adminButton}>Filter</button>
      </form>

      <Table
        head={
          <>
            <th>When</th>
            <th>Booking</th>
            <th>Customer</th>
            <th>Staff</th>
            <th>Status</th>
            <th className="text-right">Total</th>
          </>
        }
      >
        {rows.map((b) => (
          <tr key={b.id} className="hover:bg-sand-50">
            <td className="nums whitespace-nowrap">
              <Link href={`/admin/bookings/${b.id}`} className="block text-ink">
                {formatManilaDate(b.starts_at)}
                <span className="block text-xs text-muted">
                  {formatManilaTime(b.starts_at)} – {formatManilaTime(b.ends_at)}
                </span>
              </Link>
            </td>
            <td>
              <Link href={`/admin/bookings/${b.id}`} className="font-medium text-burgundy-700 hover:underline">
                {b.reference}
              </Link>
              <span className="block text-xs text-muted">
                {b.packages?.name}
                {b.source === "admin" ? " · studio booking" : ""}
              </span>
            </td>
            <td>
              <span className="text-ink">{b.customers?.full_name}</span>
              {b.customers?.phone ? <span className="nums block text-xs text-muted">{b.customers.phone}</span> : null}
            </td>
            <td className="text-muted">{b.staff_members?.full_name ?? "—"}</td>
            <td>
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={b.status} />
                {/* Payment state only matters while money is expected or has moved. */}
                {b.payment && (b.payment.payment_status !== "unpaid" || ["pending", "approved", "completed"].includes(b.status)) ? (
                  <PaymentBadge status={b.payment.payment_status} />
                ) : null}
              </div>
            </td>
            <td className="nums text-right text-ink">{formatPeso(b.total_amount)}</td>
          </tr>
        ))}
      </Table>
      {pastEnd ? (
        <EmptyState>
          Nothing on page {page}.{" "}
          <Link href={hrefFor({ page: 1 })} className="text-burgundy-700 underline underline-offset-4">
            Back to the first page
          </Link>
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>
          No bookings match. {filters.when === "upcoming" ? "Try “All dates” to include past sessions." : null}
        </EmptyState>
      ) : null}

      {pastEnd ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>
            {total} booking{total === 1 ? "" : "s"}
            {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
          </p>
          {pageCount > 1 ? (
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={hrefFor({ page: page - 1 })} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
                  Previous
                </Link>
              ) : null}
              {page < pageCount ? (
                <Link href={hrefFor({ page: page + 1 })} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
