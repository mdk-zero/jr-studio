import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listCustomers } from "@/lib/admin-people";
import { customerListSchema, CUSTOMER_TIERS, type CustomerListFilters } from "@/lib/validators/people";
import { TIER_LABEL } from "@/lib/people-labels";
import { formatManilaDate } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { Badge, PageHeader, Table } from "@/components/admin/ui";
import { adminButton, adminInput } from "@/components/admin/styles";
import { Pager } from "@/components/admin/pager";

export const metadata: Metadata = { title: "Customers" };

const DEFAULTS: CustomerListFilters = {
  q: "",
  tier: "all",
  status: "active",
  account: "all",
  marketing: "all",
  sort: "name",
  page: 1,
};

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  await requireStaff("/admin/customers");
  const raw = await props.searchParams;
  const filters = customerListSchema.parse(raw);
  const { rows, total, page, pageCount } = await listCustomers(filters);

  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const key of Object.keys(DEFAULTS) as Array<keyof CustomerListFilters>) {
      const value = key === "page" ? nextPage : filters[key];
      if (value !== DEFAULTS[key]) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `/admin/customers?${query}` : "/admin/customers";
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Everyone the studio has booked, with or without an online account."
      />

      {raw.deleted ? (
        <p role="status" className="rounded-lg bg-burgundy-50 px-4 py-3 text-sm text-burgundy-700">
          Customer deleted.
        </p>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-muted">Search</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, email or mobile"
            className={`${adminInput} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="tier" className="block text-xs font-medium text-muted">Tier</label>
          <select id="tier" name="tier" defaultValue={filters.tier} className={`${adminInput} mt-1 w-auto`}>
            <option value="all">Any tier</option>
            {CUSTOMER_TIERS.map((t) => (
              <option key={t} value={t}>{TIER_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="account" className="block text-xs font-medium text-muted">Account</label>
          <select id="account" name="account" defaultValue={filters.account} className={`${adminInput} mt-1 w-auto`}>
            <option value="all">Anyone</option>
            <option value="login">Signed up online</option>
            <option value="walkin">Walk-in (no login)</option>
          </select>
        </div>
        <div>
          <label htmlFor="marketing" className="block text-xs font-medium text-muted">Promotions</label>
          <select id="marketing" name="marketing" defaultValue={filters.marketing} className={`${adminInput} mt-1 w-auto`}>
            <option value="all">Anyone</option>
            <option value="yes">Opted in</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted">Status</label>
          <select id="status" name="status" defaultValue={filters.status} className={`${adminInput} mt-1 w-auto`}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="block text-xs font-medium text-muted">Sort</label>
          <select id="sort" name="sort" defaultValue={filters.sort} className={`${adminInput} mt-1 w-auto`}>
            <option value="name">Name</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
        <button type="submit" className={adminButton}>Filter</button>
      </form>

      <Table
        head={
          <>
            <th>Customer</th>
            <th>Contact</th>
            <th>Tier</th>
            <th className="text-right">Bookings</th>
            <th>Last session</th>
            <th className="text-right">Paid</th>
          </>
        }
      >
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-sand-50">
            <td>
              <Link href={`/admin/customers/${c.id}`} className="font-medium text-burgundy-700 hover:underline">
                {c.full_name}
              </Link>
              <span className="block text-xs text-muted">
                {c.profile_id ? "Online account" : "Walk-in"}
                {c.status === "inactive" ? " · inactive" : ""}
                {c.marketing_opt_in ? " · gets promotions" : ""}
              </span>
            </td>
            <td className="text-muted">
              <span className="block break-all">{c.email ?? "—"}</span>
              {c.phone ? <span className="nums block text-xs">{c.phone}</span> : null}
            </td>
            <td>
              <Badge tone={c.tier === "regular" ? "off" : "on"}>{TIER_LABEL[c.tier]}</Badge>
            </td>
            <td className="nums text-right text-ink">{c.summary?.bookings_count ?? 0}</td>
            <td className="nums text-muted">
              {c.summary?.next_session_at ? (
                <span className="text-ink">Next {formatManilaDate(c.summary.next_session_at)}</span>
              ) : c.summary?.last_session_at ? (
                formatManilaDate(c.summary.last_session_at)
              ) : (
                "—"
              )}
            </td>
            <td className="nums text-right text-ink">{formatPeso(c.summary?.total_paid ?? 0)}</td>
          </tr>
        ))}
      </Table>

      <Pager
        total={total}
        page={page}
        pageCount={pageCount}
        shown={rows.length}
        noun={["customer", "customers"]}
        hrefFor={hrefFor}
        empty={filters.q ? `Nobody matches “${filters.q}”.` : "No customers match these filters."}
      />
    </div>
  );
}
