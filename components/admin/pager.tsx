import Link from "next/link";
import { EmptyState } from "@/components/admin/ui";

/**
 * Count, page position and previous/next links under a server-paged list.
 * A page number past the end (an old link, a hand-edited URL) says so and
 * links back, rather than claiming there is nothing at all.
 */
export function Pager({
  total,
  page,
  pageCount,
  shown,
  noun,
  hrefFor,
  empty,
}: {
  total: number;
  page: number;
  pageCount: number;
  shown: number;
  noun: [singular: string, plural: string];
  hrefFor: (page: number) => string;
  empty: React.ReactNode;
}) {
  if (shown === 0 && page > 1) {
    return (
      <EmptyState>
        Nothing on page {page}.{" "}
        <Link href={hrefFor(1)} className="text-burgundy-700 underline underline-offset-4">
          Back to the first page
        </Link>
      </EmptyState>
    );
  }
  if (shown === 0) return <EmptyState>{empty}</EmptyState>;

  const link = "rounded-lg border border-sand-300 bg-white px-3 py-1.5 hover:bg-sand-100";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p>
        {total} {total === 1 ? noun[0] : noun[1]}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
      </p>
      {pageCount > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? <Link href={hrefFor(page - 1)} className={link}>Previous</Link> : null}
          {page < pageCount ? <Link href={hrefFor(page + 1)} className={link}>Next</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
