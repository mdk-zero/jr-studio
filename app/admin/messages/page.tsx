import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listMessages } from "@/lib/admin-content";
import { messageListSchema } from "@/lib/validators/content";
import { formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { PageHeader } from "@/components/admin/ui";
import { Pager } from "@/components/admin/pager";
import { ActionButton } from "@/components/admin/action-button";
import { deleteMessageAction, markReadAction } from "@/app/admin/messages/actions";

export const metadata: Metadata = { title: "Messages" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default async function MessagesPage(props: PageProps<"/admin/messages">) {
  const user = await requireStaff("/admin/messages");
  const filters = messageListSchema.parse(await props.searchParams);
  const { rows, total, page, pageCount } = await listMessages(filters);

  const hrefFor = (nextPage: number, filter = filters.filter) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/admin/messages?${query}` : "/admin/messages";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="What visitors send through the contact form on the website. Reply by email or phone; replies are not sent from here."
      />

      <nav className="flex gap-1">
        {(["all", "unread"] as const).map((filter) => {
          const active = filters.filter === filter;
          return (
            <Link
              key={filter}
              href={hrefFor(1, filter)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                active ? "bg-burgundy-600 text-white" : "bg-white text-muted hover:bg-sand-100 hover:text-ink"
              }`}
            >
              {filter === "all" ? "All" : "Unread"}
            </Link>
          );
        })}
      </nav>

      <ul className="flex flex-col gap-3">
        {rows.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border bg-white p-5 ${m.is_read ? "border-sand-300" : "border-burgundy-300 shadow-sm"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">
                  {!m.is_read ? <span className="mr-2 inline-block size-2 rounded-full bg-burgundy-600 align-middle" aria-label="Unread" /> : null}
                  {m.name}
                </p>
                <p className="text-sm text-muted">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to J&R Studio")}`}
                    className="break-all hover:text-ink hover:underline"
                  >
                    {m.email}
                  </a>
                  {m.phone ? (
                    <>
                      {" · "}
                      <a href={`tel:${m.phone}`} className="nums hover:text-ink hover:underline">{m.phone}</a>
                    </>
                  ) : null}
                </p>
              </div>
              <p className="nums text-xs text-muted">
                {formatManilaDate(m.created_at)}, {formatManilaTime(m.created_at)}
              </p>
            </div>

            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink">{m.message}</p>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
              <ActionButton action={markReadAction} fields={{ id: m.id, is_read: String(!m.is_read) }} feedback="error">
                {m.is_read ? "Mark unread" : "Mark read"}
              </ActionButton>
              {user.role === "admin" ? (
                <ActionButton
                  action={deleteMessageAction}
                  fields={{ id: m.id }}
                  confirm={`Delete the message from ${m.name}?`}
                  className="text-red-700"
                  feedback="error"
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
        noun={["message", "messages"]}
        hrefFor={(p) => hrefFor(p)}
        empty={filters.filter === "unread" ? "All caught up." : "No messages yet."}
      />
    </div>
  );
}
