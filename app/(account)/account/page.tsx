import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/dal";
import { getMyBookings, PAYMENT_COPY, STATUS_COPY } from "@/lib/bookings";
import { formatDuration, formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "My bookings" };

/** Reads the signed-in customer's own data, so it renders per request. */
export const instant = false;

export default async function AccountPage() {
  const [user, bookings] = await Promise.all([getCurrentUser(), getMyBookings()]);

  const upcoming = bookings.filter((b) => b.isUpcoming);
  const past = bookings.filter((b) => !b.isUpcoming);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-burgundy-700">
            Hello, {user?.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">Your sessions with J&amp;R Studio.</p>
        </div>
        <Link
          href="/book"
          className="caps rounded-full bg-burgundy-600 px-5 py-2.5 text-white transition hover:bg-burgundy-700"
        >
          Book a session
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="border border-sand-300 bg-white p-8 text-center">
          <p className="text-sm text-muted">
            You have no bookings yet.{" "}
            <Link href="/" className="text-burgundy-600 underline underline-offset-4">
              Browse the packages
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="Upcoming">
          {upcoming.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Section>
      ) : null}

      {past.length > 0 ? (
        <Section title="Past and cancelled">
          {past.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="caps border-b border-burgundy-600/15 pb-3 text-burgundy-500">{title}</h2>
      <div className="divide-y divide-sand-200">{children}</div>
    </section>
  );
}

function BookingRow({ booking }: { booking: Awaited<ReturnType<typeof getMyBookings>>[number] }) {
  const status = STATUS_COPY[booking.status];
  const payment = booking.payment?.payment_status
    ? PAYMENT_COPY[booking.payment.payment_status]
    : null;

  return (
    <Link
      href={`/account/bookings/${booking.id}`}
      className="flex flex-wrap items-center justify-between gap-4 py-4 transition hover:bg-sand-50"
    >
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-ink">
          {booking.packages?.name ?? "Session"}
        </p>
        <p className="nums mt-1 text-sm text-muted">
          {formatManilaDate(booking.starts_at)} · {formatManilaTime(booking.starts_at)}
          {booking.packages?.duration_minutes
            ? ` · ${formatDuration(booking.packages.duration_minutes)}`
            : ""}
        </p>
        <p className="caps mt-1 text-burgundy-500/60">{booking.reference}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}>
          {status.label}
        </span>
        {payment ? (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${payment.tone}`}>
            {payment.label}
          </span>
        ) : null}
        <span className="font-display nums ml-2 text-lg font-semibold text-ink">
          {formatPeso(booking.total_amount)}
        </span>
      </div>
    </Link>
  );
}
