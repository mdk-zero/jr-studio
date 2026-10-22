import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_TIERS } from "@/lib/validators/people";
import { formatManilaDate, formatManilaTime } from "@/lib/datetime";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CampaignForm } from "@/components/admin/customers/campaign-form";

export const metadata: Metadata = { title: "Email customers" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

async function audienceCounts() {
  const supabase = await createClient();
  const count = async (tier?: (typeof CUSTOMER_TIERS)[number]) => {
    let query = supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("marketing_opt_in", true)
      .not("email", "is", null);
    if (tier) query = query.eq("tier", tier);
    const { count: n } = await query;
    return n ?? 0;
  };
  const [all, ...tiers] = await Promise.all([count(), ...CUSTOMER_TIERS.map((t) => count(t))]);
  return {
    all,
    ...Object.fromEntries(CUSTOMER_TIERS.map((t, i) => [t, tiers[i]])),
  } as Record<"all" | (typeof CUSTOMER_TIERS)[number], number>;
}

/** Recent sends, one line per campaign, from the per-recipient log. */
async function recentCampaigns() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_log")
    .select("campaign_key, subject, status, created_at")
    .not("campaign_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  const byKey = new Map<string, { subject: string; at: string; counts: Record<string, number> }>();
  for (const row of data ?? []) {
    const entry = byKey.get(row.campaign_key!) ?? { subject: row.subject, at: row.created_at, counts: {} };
    entry.counts[row.status] = (entry.counts[row.status] ?? 0) + 1;
    if (row.created_at < entry.at) entry.at = row.created_at;
    byKey.set(row.campaign_key!, entry);
  }
  return [...byKey.values()].slice(0, 10);
}

export default async function EmailCustomersPage() {
  await requireAdmin("/admin/customers/email");
  const [audience, campaigns] = await Promise.all([audienceCounts(), recentCampaigns()]);
  const testMode = process.env.EMAIL_MODE !== "live";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email customers"
        description="News and offers, sent only to active customers who agreed to receive them."
      />

      {testMode ? (
        <p className="rounded-lg bg-sand-100 px-4 py-3 text-sm text-ink">
          Email is in <strong>test mode</strong>: every message goes to Resend&apos;s test inbox instead of the
          customer. Set <code>EMAIL_MODE=live</code> on the production server to send for real.
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel title="New email">
          {audience.all === 0 ? (
            <p className="text-sm text-muted">
              No customer has agreed to promotional email yet. Customers opt in when they sign up or from their
              profile; staff can record consent on a customer&apos;s record.
            </p>
          ) : (
            <CampaignForm campaignKey={randomUUID()} audience={audience} />
          )}
        </Panel>

        <Panel title="Sent recently">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted">Nothing sent yet.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {campaigns.map((c) => (
                <li key={c.at + c.subject}>
                  <p className="font-medium text-ink">{c.subject}</p>
                  <p className="nums text-xs text-muted">
                    {formatManilaDate(c.at)}, {formatManilaTime(c.at)} ·{" "}
                    {Object.entries(c.counts)
                      .map(([status, n]) => `${n} ${status}`)
                      .join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
