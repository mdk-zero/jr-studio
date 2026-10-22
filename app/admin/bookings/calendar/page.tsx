import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getWeek } from "@/lib/admin-bookings";
import {
  addDaysToDateString,
  formatDateString,
  formatManilaTime,
  manilaToday,
  startOfWeek,
} from "@/lib/datetime";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/bookings/badges";

export const metadata: Metadata = { title: "Booking calendar" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

// Pending requests are outlined so they read as "not confirmed yet" at a glance.
const ACCENT = {
  pending: "border-dashed border-sand-400 bg-white",
  approved: "border-burgundy-300 bg-burgundy-50",
  completed: "border-sand-300 bg-sand-100",
} as const;

/** "08:00:00" -> "8am", "13:30:00" -> "1:30pm". */
function clock(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  const suffix = h >= 12 ? "pm" : "am";
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export default async function BookingCalendarPage(props: PageProps<"/admin/bookings/calendar">) {
  await requireStaff("/admin/bookings/calendar");
  const { week } = await props.searchParams;

  const requested = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : manilaToday();
  const weekStart = startOfWeek(requested);
  const days = await getWeek(weekStart);

  const sessions = days.reduce((n, d) => n + d.bookings.length, 0);
  const pending = days.reduce((n, d) => n + d.bookings.filter((b) => b.status === "pending").length, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Week of ${formatDateString(weekStart)}`}
        description={`${sessions} session${sessions === 1 ? "" : "s"}${pending ? `, ${pending} still pending` : ""}. Cancelled and declined bookings are left off.`}
        action={
          <div className="flex gap-2 text-sm">
            <Link href={`/admin/bookings/calendar?week=${addDaysToDateString(weekStart, -7)}`} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
              ← Previous
            </Link>
            <Link href="/admin/bookings/calendar" className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
              This week
            </Link>
            <Link href={`/admin/bookings/calendar?week=${addDaysToDateString(weekStart, 7)}`} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100">
              Next →
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {days.map((day) => (
          <section
            key={day.date}
            aria-label={formatDateString(day.date)}
            className={`flex min-h-32 flex-col rounded-xl border bg-white p-3 ${
              day.isToday ? "border-burgundy-500 ring-1 ring-burgundy-500" : "border-sand-300"
            }`}
          >
            <header className="mb-2 flex items-baseline justify-between gap-2 lg:block">
              <h2 className="text-sm font-semibold text-ink">
                {formatDateString(day.date)}
                {day.isToday ? <span className="ml-1.5 text-xs font-medium text-burgundy-600">Today</span> : null}
              </h2>
              <p className="text-xs text-muted">
                {day.blockedReason
                  ? `Blocked: ${day.blockedReason}`
                  : day.hours
                    ? `${clock(day.hours.opens)}–${clock(day.hours.closes)}`
                    : "Closed"}
              </p>
            </header>

            {day.bookings.length === 0 ? (
              <p className="text-xs text-sand-400">{day.isOpen ? "Nothing booked" : ""}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {day.bookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className={`block rounded-lg border px-2.5 py-2 text-xs transition hover:border-burgundy-500 ${
                        ACCENT[b.status as keyof typeof ACCENT] ?? "border-sand-300"
                      }`}
                    >
                      <span className="nums block font-semibold text-ink">
                        {formatManilaTime(b.starts_at)} – {formatManilaTime(b.ends_at)}
                      </span>
                      <span className="block truncate text-ink">{b.customers?.full_name}</span>
                      <span className="block truncate text-muted">{b.packages?.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <StatusBadge status={b.status} />
                        {b.staff_members ? <span className="truncate text-muted">{b.staff_members.full_name}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
