import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { getSettingsAdmin } from "@/lib/admin-content";
import { formatDateString, manilaToday } from "@/lib/datetime";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-button";
import {
  BlockedDateForm,
  BookingRulesForm,
  BusinessHoursForm,
  StudioDetailsForm,
} from "@/components/admin/settings/settings-forms";
import { removeBlockedDateAction } from "@/app/admin/settings/actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin("/admin/settings");
  const { settings, hours, blocked } = await getSettingsAdmin();
  if (!settings) throw new Error("studio_settings has no row");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Studio details for the website, and the rules online booking follows."
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel title="Studio details">
          <StudioDetailsForm
            settings={{ ...settings, socials: (settings.socials ?? {}) as Record<string, string> }}
          />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Opening hours">
            <BusinessHoursForm hours={hours} />
          </Panel>

          <Panel title="Closed days">
            <BlockedDateForm today={manilaToday()} />
            {blocked.length > 0 ? (
              <ul className="mt-4 divide-y divide-sand-200 text-sm">
                {blocked.map((day) => (
                  <li key={day.blocked_on} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="nums text-ink">{formatDateString(day.blocked_on)}</span>
                      {day.reason ? <span className="text-muted"> · {day.reason}</span> : null}
                    </span>
                    <ActionButton action={removeBlockedDateAction} fields={{ blocked_on: day.blocked_on }} feedback="error">
                      Reopen
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">No upcoming closed days.</p>
            )}
          </Panel>
        </div>

        <Panel title="Booking rules">
          <BookingRulesForm rules={settings} />
        </Panel>
      </div>
    </div>
  );
}
