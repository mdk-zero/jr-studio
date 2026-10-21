"use client";

import { useActionState } from "react";
import { saveCustomerAction } from "@/app/admin/customers/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { CUSTOMER_TIERS } from "@/lib/validators/people";
import { TIER_LABEL } from "@/lib/people-labels";
import { useFormMemory } from "@/components/forms/use-form-memory";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tier: (typeof CUSTOMER_TIERS)[number];
  profile_id: string | null;
  marketing_opt_in: boolean;
};

const initial: ActionState = {};

/** Adds a walk-in, or edits an existing record. */
export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, action] = useActionState(saveCustomerAction, initial);
  const memory = useFormMemory(state);
  const linked = Boolean(customer?.profile_id);

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4">
      <ActionFeedback state={state} />
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}

      <div>
        <label htmlFor="full_name" className="text-sm font-medium text-ink">Full name</label>
        <input id="full_name" name="full_name" required defaultValue={memory.text("full_name", customer?.full_name)} className={`${adminInput} mt-1`} />
        <FieldError errors={state.errors?.full_name} />
      </div>

      {/* One column: this form also sits in the customer page's narrow sidebar. */}
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={memory.text("email", customer?.email)}
            readOnly={linked}
            className={`${adminInput} mt-1 ${linked ? "bg-sand-50 text-muted" : ""}`}
          />
          <p className="mt-1 text-xs text-muted">
            {linked
              ? "This is their login, so it can't be changed here."
              : "If they later sign up with this email, the account picks up this record and its bookings."}
          </p>
          <FieldError errors={state.errors?.email} />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm font-medium text-ink">Mobile</label>
          <input id="phone" name="phone" inputMode="tel" placeholder="09171234567" defaultValue={memory.text("phone", customer?.phone)} className={`${adminInput} nums mt-1`} />
          <FieldError errors={state.errors?.phone} />
        </div>
      </div>

      <div>
        <label htmlFor="address" className="text-sm font-medium text-ink">Address <span className="font-normal text-muted">(optional)</span></label>
        <input id="address" name="address" defaultValue={memory.text("address", customer?.address)} className={`${adminInput} mt-1`} />
      </div>

      <div>
        <label htmlFor="tier" className="text-sm font-medium text-ink">Tier</label>
        <select id="tier" name="tier" defaultValue={memory.text("tier", customer?.tier ?? "regular")} className={`${adminInput} mt-1 w-auto`}>
          {CUSTOMER_TIERS.map((t) => (
            <option key={t} value={t}>{TIER_LABEL[t]}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">A label for the studio. It does not change prices.</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          name="marketing_opt_in"
          type="checkbox"
          defaultChecked={memory.checked("marketing_opt_in", customer?.marketing_opt_in ?? false)}
          className="mt-0.5 size-4 accent-burgundy-600"
        />
        <span>
          Agreed to receive studio news and offers by email
          <span className="block text-xs text-muted">Only tick this if they said yes. Bulk email goes to these customers only.</span>
        </span>
      </label>

      <div>
        <SubmitButton>{customer ? "Save changes" : "Add customer"}</SubmitButton>
      </div>
    </form>
  );
}
