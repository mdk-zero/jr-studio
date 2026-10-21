import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listReviewCandidates, listTestimonials } from "@/lib/admin-content";
import { testimonialListSchema } from "@/lib/validators/content";
import { formatManilaDate } from "@/lib/datetime";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { Pager } from "@/components/admin/pager";
import { ActionButton } from "@/components/admin/action-button";
import { EditReview } from "@/components/admin/testimonials/edit-review";
import {
  deleteTestimonialAction,
  featureAction,
  moderateAction,
  requestFeedbackAction,
} from "@/app/admin/testimonials/actions";

export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { value: "pending", label: "To review" },
  { value: "approved", label: "Published" },
  { value: "rejected", label: "Hidden" },
  { value: "all", label: "All" },
] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-burgundy-600" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-sand-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function TestimonialsPage(props: PageProps<"/admin/testimonials">) {
  const user = await requireStaff("/admin/testimonials");
  const filters = testimonialListSchema.parse(await props.searchParams);
  const [{ rows, total, page, pageCount, counts }, candidates] = await Promise.all([
    listTestimonials(filters),
    listReviewCandidates(),
  ]);
  const isAdmin = user.role === "admin";

  const hrefFor = (nextPage: number, status = filters.status) => {
    const params = new URLSearchParams();
    if (status !== "pending") params.set("status", status);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/admin/testimonials?${query}` : "/admin/testimonials";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reviews"
        description="Customer reviews appear on the website only after someone here publishes them. Featured reviews show first on the home page."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <nav className="flex flex-wrap gap-1">
            {TABS.map((tab) => {
              const active = filters.status === tab.value;
              const n = tab.value === "all" ? null : counts[tab.value];
              return (
                <Link
                  key={tab.value}
                  href={hrefFor(1, tab.value)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-sm transition ${
                    active ? "bg-burgundy-600 text-white" : "bg-white text-muted hover:bg-sand-100 hover:text-ink"
                  }`}
                >
                  {tab.label}
                  {n ? <span className="nums ml-1.5 opacity-80">{n}</span> : null}
                </Link>
              );
            })}
          </nav>

          <ul className="flex flex-col gap-3">
            {rows.map((t) => (
              <li key={t.id} className="rounded-xl border border-sand-300 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Stars rating={t.rating} />
                    <p className="mt-1 text-sm font-medium text-ink">
                      {t.author_name ?? t.customers?.full_name}
                      <span className="font-normal text-muted">
                        {" "}· {t.packages?.name ?? "Session"} · {formatManilaDate(t.created_at)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {t.status === "approved" ? <Badge tone="on">Published</Badge> : null}
                    {t.status === "rejected" ? <Badge tone="off">Hidden</Badge> : null}
                    {t.status === "pending" ? <Badge tone="info">Waiting</Badge> : null}
                    {t.is_featured ? <Badge tone="on">Featured</Badge> : null}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink">{t.message}</p>

                <p className="mt-3 text-xs text-muted">
                  From{" "}
                  {t.customers ? (
                    <Link href={`/admin/customers/${t.customers.id}`} className="hover:text-ink hover:underline">
                      {t.customers.full_name}
                    </Link>
                  ) : (
                    "a former customer"
                  )}
                  {t.bookings ? (
                    <>
                      {" "}about{" "}
                      <Link href={`/admin/bookings/${t.bookings.id}`} className="hover:text-ink hover:underline">
                        {t.bookings.reference}
                      </Link>
                    </>
                  ) : null}
                  {t.admin_notes ? <span className="block">Studio note: {t.admin_notes}</span> : null}
                </p>

                <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-sand-200 pt-4">
                  {t.status !== "approved" ? (
                    <ActionButton action={moderateAction} fields={{ id: t.id, status: "approved" }} quiet={false} className="px-4 py-1.5 text-xs">
                      Publish
                    </ActionButton>
                  ) : (
                    <ActionButton action={featureAction} fields={{ id: t.id, is_featured: String(!t.is_featured) }}>
                      {t.is_featured ? "Unfeature" : "Feature"}
                    </ActionButton>
                  )}
                  {t.status !== "rejected" ? (
                    <ActionButton action={moderateAction} fields={{ id: t.id, status: "rejected" }}>
                      Hide
                    </ActionButton>
                  ) : null}
                  {t.status !== "pending" ? (
                    <ActionButton action={moderateAction} fields={{ id: t.id, status: "pending" }}>
                      Back to review
                    </ActionButton>
                  ) : null}
                  <EditReview id={t.id} authorName={t.author_name ?? ""} message={t.message} adminNotes={t.admin_notes} />
                  {isAdmin ? (
                    <ActionButton
                      action={deleteTestimonialAction}
                      fields={{ id: t.id }}
                      confirm="Delete this review for good? Hiding it keeps a record."
                      className="text-red-700"
                    >
                      Delete
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <Pager
            total={total}
            page={page}
            pageCount={pageCount}
            shown={rows.length}
            noun={["review", "reviews"]}
            hrefFor={(p) => hrefFor(p)}
            empty={filters.status === "pending" ? "Nothing waiting. New reviews appear here first." : "No reviews here."}
          />
        </div>

        <Panel title="Ask for a review">
          <p className="mb-4 text-sm text-muted">
            Sessions completed in the last 90 days without a review. The customer gets an email with a link that
            works without an account.
          </p>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">Every recent session has a review.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-sand-200 text-sm">
              {candidates.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 py-3">
                  <div>
                    <p className="text-ink">{c.customer?.full_name}</p>
                    <p className="nums text-xs text-muted">
                      {c.packageName} · {formatManilaDate(c.starts_at)}
                      {c.requestedAt ? ` · asked ${formatManilaDate(c.requestedAt)}` : ""}
                    </p>
                  </div>
                  {c.customer?.email ? (
                    <ActionButton action={requestFeedbackAction} fields={{ booking_id: c.id }} pendingLabel="Sending…">
                      {c.requestedAt ? "Send again" : "Request review"}
                    </ActionButton>
                  ) : (
                    <p className="text-xs text-muted">No email on file.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
