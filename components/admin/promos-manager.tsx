"use client";

import { useActionState, useState } from "react";
import { deletePromotion, savePromotion, type ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { Badge, Panel, Table } from "@/components/admin/ui";
import { useFormMemory } from "@/components/forms/use-form-memory";

type PromoRow = {
  id: string;
  name: string;
  discount_percent: number;
  starts_on: string;
  ends_on: string;
  visible_to_customers: boolean;
  status: string;
  packageIds: string[];
};

const initial: ActionState = {};

const STATUS_TONE = { active: "on", upcoming: "info", expired: "off" } as const;

export function PromosManager({
  promotions,
  packages,
}: {
  promotions: PromoRow[];
  packages: Array<{ id: string; name: string }>;
}) {
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [state, action] = useActionState(savePromotion, initial);
  const memory = useFormMemory(state);
  const [deleteState, deleteAction] = useActionState(deletePromotion, initial);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-3">
        <ActionFeedback state={deleteState} />
        <Table
          head={
            <>
              <th>Promotion</th>
              <th>Discount</th>
              <th>Runs</th>
              <th>Packages</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </>
          }
        >
          {promotions.map((promo) => (
            <tr key={promo.id}>
              <td>
                <p className="font-medium text-ink">{promo.name}</p>
                {!promo.visible_to_customers ? (
                  <p className="text-xs text-muted">Hidden from the public site</p>
                ) : null}
              </td>
              <td className="nums text-ink">{promo.discount_percent}%</td>
              <td className="nums text-xs text-muted">
                {promo.starts_on} → {promo.ends_on}
              </td>
              <td className="text-muted">{promo.packageIds.length}</td>
              <td>
                {/* Status is computed from the dates, never stored, so it cannot
                    go stale the way the legacy status column did. */}
                <Badge tone={STATUS_TONE[promo.status as keyof typeof STATUS_TONE] ?? "off"}>
                  {promo.status}
                </Badge>
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(promo)}
                    className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-sand-100"
                  >
                    Edit
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={promo.id} />
                    <SubmitButton quiet pendingLabel="…" confirm={`Delete “${promo.name}”?`}>
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Panel title={editing ? "Edit promotion" : "New promotion"}>
        <form onSubmit={memory.onSubmit} key={editing?.id ?? "new"} action={action} className="flex flex-col gap-4">
          <ActionFeedback state={state} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <div>
            <label htmlFor="name" className="text-sm font-medium text-ink">Name</label>
            <input id="name" name="name" defaultValue={memory.text("name", editing?.name)} required className={`${adminInput} mt-1`} />
            <FieldError errors={state.errors?.name} />
          </div>

          <div>
            <label htmlFor="discount_percent" className="text-sm font-medium text-ink">Discount (%)</label>
            <input
              id="discount_percent"
              name="discount_percent"
              type="number"
              min={1}
              max={100}
              defaultValue={memory.text("discount_percent", editing?.discount_percent ?? 10)}
              required
              className={`${adminInput} mt-1`}
            />
            <FieldError errors={state.errors?.discount_percent} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="starts_on" className="text-sm font-medium text-ink">Starts</label>
              <input id="starts_on" name="starts_on" type="date" defaultValue={memory.text("starts_on", editing?.starts_on)} required className={`${adminInput} mt-1`} />
              <FieldError errors={state.errors?.starts_on} />
            </div>
            <div>
              <label htmlFor="ends_on" className="text-sm font-medium text-ink">Ends</label>
              <input id="ends_on" name="ends_on" type="date" defaultValue={memory.text("ends_on", editing?.ends_on)} required className={`${adminInput} mt-1`} />
              <FieldError errors={state.errors?.ends_on} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">The end date is included in the promotion.</p>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Applies to</legend>
            <div className="mt-1 max-h-56 overflow-y-auto pr-1">
              {packages.map((pkg) => (
                <label key={pkg.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="package_ids"
                    value={pkg.id}
                    defaultChecked={memory.includes("package_ids", pkg.id, editing?.packageIds.includes(pkg.id) ?? false)}
                    className="size-4 accent-burgundy-600"
                  />
                  {pkg.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">
              If several promotions overlap, the biggest discount wins.
            </p>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              name="visible_to_customers"
              type="checkbox"
              defaultChecked={memory.checked("visible_to_customers", editing ? editing.visible_to_customers : true)}
              className="size-4 accent-burgundy-600"
            />
            Advertise on the public site
          </label>

          <div className="flex gap-2">
            <SubmitButton>{editing ? "Save changes" : "Add promotion"}</SubmitButton>
            {editing ? (
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-ink transition hover:bg-sand-100">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}
