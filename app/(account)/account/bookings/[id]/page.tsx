import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { getMyBooking, PAYMENT_COPY, STATUS_COPY } from "@/lib/bookings";
import { formatDuration, formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { BookingActions } from "@/components/account/booking-actions";
import { ReviewForm } from "@/components/marketing/review-form";
import { submitTestimonialAction } from "@/app/(account)/account/actions";

export const metadata: Metadata = { title: "Booking" };

/** "Andrea Salazar" -> "Andrea S.", the default credit on a public review. */
function shortName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

export default async function BookingDetailPage(props: PageProps<"/account/bookings/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const { created } = await props.searchParams;

  // RLS scopes this to the signed-in customer, so a stranger's id is a 404.
  const booking = await getMyBooking(id);
  if (!booking) notFound();

  const status = STATUS_COPY[booking.status];
  const payment = booking.payment?.payment_status
    ? PAYMENT_COPY[booking.payment.payment_status]
    : null;

  return (
    <div className="flex flex-col gap-8">
      <nav className="caps text-muted">
        <Link href="/account" className="hover:text-burgundy-700">
          My bookings
        </Link>
        <span className="mx-2 text-burgundy-600/30">/</span>
        <span className="text-burgundy-600">{booking.reference}</span>
      </nav>

      {created ? (
        <p role="status" className="rounded-lg bg-burgundy-50 px-4 py-3 text-sm text-burgundy-700">
          Request received. The studio will confirm your slot shortly — we will email you either way.
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-burgundy-600/15 pb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-burgundy-700">
            {booking.packages?.name ?? "Session"}
          </h1>
          <p className="nums mt-2 text-ink">
            {formatManilaDate(booking.starts_at)}
            <br />
            <span className="text-muted">
              {formatManilaTime(booking.starts_at)} – {formatManilaTime(booking.ends_at)}
              {booking.packages?.duration_minutes
                ? ` (${formatDuration(booking.packages.duration_minutes)})`
                : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}>
            {status.label}
          </span>
          {payment ? (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${payment.tone}`}>
              {payment.label}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="caps text-burgundy-500">What you booked</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink">{booking.packages?.name}</dt>
                <dd className="nums text-ink">{formatPeso(booking.package_price)}</dd>
              </div>
              {booking.addons.map((addon, i) => (
                <div key={i} className="flex justify-between gap-4">
                  <dt className="text-muted">
                    {addon.addons?.name}
                    {addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
                  </dt>
                  <dd className="nums text-muted">
                    + {formatPeso(addon.unit_price * addon.quantity)}
                  </dd>
                </div>
              ))}
              {booking.discount_amount > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-burgundy-600">Discount</dt>
                  <dd className="nums text-burgundy-600">
                    − {formatPeso(booking.discount_amount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-sand-200 pt-2">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-display nums text-xl font-semibold text-ink">
                  {formatPeso(booking.total_amount)}
                </dd>
              </div>
              {booking.payment && Number(booking.payment.paid_total) > 0 ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Paid so far</dt>
                    <dd className="nums text-muted">{formatPeso(booking.payment.paid_total)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink">Balance</dt>
                    <dd className="nums text-ink">{formatPeso(booking.payment.balance)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </section>

          {booking.notes ? (
            <section>
              <h2 className="caps text-burgundy-500">Your notes</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink">{booking.notes}</p>
            </section>
          ) : null}

          {booking.events.length > 0 ? (
            <section>
              <h2 className="caps text-burgundy-500">History</h2>
              <ol className="mt-3 space-y-2">
                {booking.events.map((event) => (
                  <li key={event.id} className="flex gap-3 text-sm">
                    <span className="nums shrink-0 text-muted">
                      {formatManilaDate(event.created_at)}
                    </span>
                    <span className="text-ink">
                      {event.note ?? event.type.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {booking.status === "completed" ? (
            <section>
              <h2 className="caps text-burgundy-500">Your review</h2>
              {booking.review ? (
                <div className="mt-3 text-sm">
                  <p className="text-burgundy-600" aria-label={`${booking.review.rating} out of 5`}>
                    {"★".repeat(booking.review.rating)}
                    <span className="text-sand-300">{"★".repeat(5 - booking.review.rating)}</span>
                  </p>
                  <p className="mt-2 leading-relaxed whitespace-pre-line text-ink">{booking.review.message}</p>
                  <p className="mt-2 text-xs text-muted">
                    {booking.review.status === "approved"
                      ? "Published on our website. Thank you!"
                      : booking.review.status === "pending"
                        ? "Thank you! The studio reads every review before it goes on the website."
                        : "Thank you for your feedback."}
                  </p>
                </div>
              ) : (
                <div className="mt-3 border border-sand-300 bg-white p-5">
                  <p className="mb-4 text-sm text-muted">How was your session? A few words help other families find us.</p>
                  <ReviewForm
                    action={submitTestimonialAction}
                    hidden={{ booking_id: booking.id }}
                    defaultName={shortName(user.fullName)}
                  />
                </div>
              )}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="border border-sand-300 bg-white p-5">
            <BookingActions
              bookingId={booking.id}
              status={booking.status}
              cancellable={booking.cancellable}
              cancelledAt={booking.cancelled_at}
              undoWindowSeconds={booking.undoWindowSeconds}
              cancelCutoffHours={booking.cancelCutoffHours}
            />
            {!booking.cancellable && ["pending", "approved"].includes(booking.status) ? (
              <p className="text-sm text-muted">
                This session is too close to cancel online. Call the studio if you need to change it.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
