import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-heading">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      {title ? (
        <h2 className="caps mb-4 text-muted">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-150 border-collapse text-sm">
        <thead className="border-b border-line bg-raised text-left">
          <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-mono [&>th]:text-[11px] [&>th]:font-medium [&>th]:tracking-[0.12em] [&>th]:text-muted [&>th]:uppercase">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&>tr>td]:px-4 [&>tr>td]:py-3">{children}</tbody>
      </table>
    </div>
  );
}

export function Badge({ tone, children }: { tone: "on" | "off" | "info"; children: ReactNode }) {
  const styles = {
    on: "bg-tint text-on-tint",
    off: "bg-raised text-muted",
    info: "bg-raised text-ink",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}
