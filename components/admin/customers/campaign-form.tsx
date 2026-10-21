"use client";

import { useActionState, useState } from "react";
import { sendCampaignAction, type CampaignState } from "@/app/admin/customers/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { CUSTOMER_TIERS } from "@/lib/validators/people";
import { TIER_LABEL } from "@/lib/people-labels";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: CampaignState = {};

export function CampaignForm({
  campaignKey,
  audience,
}: {
  /** Fixed per page render: submitting twice is the same campaign, sent once. */
  campaignKey: string;
  audience: Record<"all" | (typeof CUSTOMER_TIERS)[number], number>;
}) {
  const [state, action] = useActionState(sendCampaignAction, initial);
  const memory = useFormMemory(state);
  const [tier, setTier] = useState<keyof typeof audience>("all");
  const count = audience[tier];

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4">
      <ActionFeedback state={state} />
      <input type="hidden" name="campaign_key" value={campaignKey} />

      <div>
        <label htmlFor="tier" className="text-sm font-medium text-ink">Send to</label>
        <select
          id="tier"
          name="tier"
          value={tier}
          onChange={(e) => setTier(e.target.value as keyof typeof audience)}
          className={`${adminInput} mt-1 w-auto`}
        >
          <option value="all">Everyone who opted in ({audience.all})</option>
          {CUSTOMER_TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]} customers who opted in ({audience[t]})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="subject" className="text-sm font-medium text-ink">Subject</label>
        <input id="subject" name="subject" defaultValue={memory.text("subject")} maxLength={150} required className={`${adminInput} mt-1`} />
        <FieldError errors={state.errors?.subject} />
      </div>

      <div>
        <label htmlFor="body" className="text-sm font-medium text-ink">Message</label>
        <textarea
          id="body"
          name="body"
          rows={10}
          maxLength={10_000}
          required
          defaultValue={memory.text("body", "Hi {name},\n\n")}
          className={`${adminInput} mt-1`}
        />
        <p className="mt-1 text-xs text-muted">
          Plain text; blank lines start new paragraphs. <code>{"{name}"}</code> becomes each customer&apos;s
          first name. An unsubscribe link is added at the bottom automatically.
        </p>
        <FieldError errors={state.errors?.body} />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input name="confirm" type="checkbox" required defaultChecked={memory.checked("confirm", false)} className="mt-0.5 size-4 accent-burgundy-600" />
        <span>
          Send this to {count} customer{count === 1 ? "" : "s"} now. This cannot be undone.
        </span>
      </label>
      <FieldError errors={state.errors?.confirm} />

      <div>
        <SubmitButton pendingLabel="Sending…">Send email</SubmitButton>
      </div>
    </form>
  );
}
