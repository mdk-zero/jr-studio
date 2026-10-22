import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getCustomer } from "@/lib/admin-people";
import { TIER_LABEL } from "@/lib/people-labels";
import { formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { Badge, Panel } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-button";
import { PaymentBadge, StatusBadge } from "@/components/admin/bookings/badges";
import { CustomerForm } from "@/components/admin/customers/customer-form";
import { NoteForm } from "@/components/admin/customers/note-form";
import { deleteCustomerAction, deleteNoteAction, setCustomerStatusAction } from "@/app/admin/customers/actions";

export const metadata: Metadata = { title: "Customer" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

const EMAIL_LABEL: Record<string, string> = {
  booking_approved: "Booking confirmed",
  booking_declined: "Request declined",
  booking_cancelled: "Booking cancelled",
  booking_rescheduled: "Booking moved",
  booking_request: "New request (to studio)",
  feedback_request: "Review request",
  campaign: "Promotion",
};

export default async function CustomerPage(props: PageProps<"/admin/customers/[id]">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const { created } = await props.searchParams;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const isAdmin = user.role === "admin";
  const summary = customer.summary;

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/customers" className="hover:text-ink">Customers</Link>
        <span className="mx-2 text-sand-400">/</span>
        <span className="text-ink">{customer.full_name}</span>
      </nav>

      {created ? (
        <p role="status" className="rounded-lg bg-burgundy-50 px-4 py-3 text-sm text-burgundy-700">
          Customer added.
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-sand-300 pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-burgundy-700">{customer.full_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {customer.profile_id ? "Online account" : "Walk-in, no login"} · customer since{" "}
            {formatManilaDate(customer.created_at)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={customer.tier === "regular" ? "off" : "on"}>{TIER_LABEL[customer.tier]}</Badge>
            {customer.status === "inactive" ? <Badge tone="off">Inactive</Badge> : null}
            {customer.marketing_opt_in ? <Badge tone="info">Gets promotions</Badge> : null}
          </div>
        </div>
        {customer.status === "active" ? (
          <Link
            href={`/admin/bookings/new?customer=${customer.id}`}
            className="rounded-full bg-burgundy-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-700"
          >
            Book a session
          </Link>
        ) : null}
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Bookings", String(summary?.bookings_count ?? 0)],
          ["Completed sessions", String(summary?.completed_count ?? 0)],
          ["Total paid", formatPeso(summary?.total_paid ?? 0)],
          [
            summary?.next_session_at ? "Next session" : "Last session",
            summary?.next_session_at
              ? formatManilaDate(summary.next_session_at)
              : summary?.last_session_at
                ? formatManilaDate(summary.last_session_at)
                : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-sand-300 bg-white px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="nums mt-1 text-lg font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Panel title="Bookings">
            {customer.bookings.length === 0 ? (
              <p className="text-sm text-muted">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-sand-200 text-sm">
                {customer.bookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium text-burgundy-700 hover:underline">
                        {b.reference}
                      </Link>
                      <span className="text-muted"> · {b.packages?.name}</span>
                      <p className="nums text-xs text-muted">
                        {formatManilaDate(b.starts_at)}, {formatManilaTime(b.starts_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={b.status} />
                      {b.payment && (b.payment.payment_status !== "unpaid" || ["pending", "approved", "completed"].includes(b.status)) ? (
                        <PaymentBadge status={b.payment.payment_status} />
                      ) : null}
                      <span className="nums w-24 text-right text-ink">{formatPeso(b.total_amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Notes">
            <NoteForm customerId={customer.id} />
            {customer.notes.length > 0 ? (
              <ul className="mt-5 flex flex-col gap-3">
                {customer.notes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-sand-50 px-4 py-3 text-sm">
                    <p className="whitespace-pre-line text-ink">{note.body}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
                      <span className="nums">
                        {note.profiles?.full_name ?? "Studio"} · {formatManilaDate(note.created_at)}
                      </span>
                      {isAdmin ? (
                        <ActionButton
                          action={deleteNoteAction}
                          fields={{ id: note.id, customer_id: customer.id }}
                          confirm="Delete this note?"
                          className="border-0 bg-transparent px-0 py-0 text-xs text-muted hover:bg-transparent hover:text-red-700"
                          feedback="error"
                        >
                          Delete
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          {customer.emails.length > 0 ? (
            <Panel title="Emails sent">
              <ul className="divide-y divide-sand-200 text-sm">
                {customer.emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-3 py-2">
                    <span className="text-ink">
                      {EMAIL_LABEL[e.template] ?? e.template}
                      <span className="block text-xs text-muted">{e.subject}</span>
                    </span>
                    <span className="nums text-xs text-muted">
                      {formatManilaDate(e.created_at)}
                      {e.status !== "sent" ? ` · ${e.status}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Details">
            <CustomerForm customer={customer} />
          </Panel>

          <Panel title="Status">
            <p className="mb-3 text-sm text-muted">
              {customer.status === "active"
                ? "Inactive customers are hidden from searches, the booking form and bulk email. Their history stays."
                : "This customer is hidden from searches, the booking form and bulk email."}
            </p>
            <ActionButton
              action={setCustomerStatusAction}
              fields={{ customer_id: customer.id, status: customer.status === "active" ? "inactive" : "active" }}
              className="px-4 py-2 text-sm"
            >
              {customer.status === "active" ? "Mark inactive" : "Make active again"}
            </ActionButton>
          </Panel>

          {isAdmin && (summary?.bookings_count ?? 0) === 0 && customer.bookings.length === 0 ? (
            <Panel title="Delete">
              <p className="mb-3 text-sm text-muted">
                Only for records made in error. Customers with any booking history cannot be deleted.
              </p>
              <ActionButton
                action={deleteCustomerAction}
                fields={{ customer_id: customer.id }}
                confirm={`Delete ${customer.full_name} for good?`}
                className="border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                Delete customer
              </ActionButton>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
