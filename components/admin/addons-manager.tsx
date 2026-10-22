"use client";

import { useActionState, useState } from "react";
import { deleteAddon, saveAddon, type ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { Badge, Panel, Table } from "@/components/admin/ui";
import { formatPeso } from "@/lib/money";
import { useFormMemory } from "@/components/forms/use-form-memory";

type AddonRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  packageIds: string[];
};

const initial: ActionState = {};

export function AddonsManager({
  addons,
  packages,
}: {
  addons: AddonRow[];
  packages: Array<{ id: string; name: string }>;
}) {
  const [editing, setEditing] = useState<AddonRow | null>(null);
  const [state, action] = useActionState(saveAddon, initial);
  const memory = useFormMemory(state);
  const [deleteState, deleteAction] = useActionState(deleteAddon, initial);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-3">
        <ActionFeedback state={deleteState} />
        <Table
          head={
            <>
              <th>Add-on</th>
              <th>Price</th>
              <th>Offered with</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </>
          }
        >
          {addons.map((addon) => (
            <tr key={addon.id}>
              <td>
                <p className="font-medium text-ink">{addon.name}</p>
                {addon.description ? (
                  <p className="line-clamp-1 text-xs text-muted">{addon.description}</p>
                ) : null}
              </td>
              <td className="nums text-ink">{formatPeso(addon.price)}</td>
              <td className="text-muted">
                {addon.packageIds.length === 0
                  ? "No packages"
                  : `${addon.packageIds.length} package${addon.packageIds.length === 1 ? "" : "s"}`}
              </td>
              <td>
                <Badge tone={addon.is_active ? "on" : "off"}>
                  {addon.is_active ? "Available" : "Off"}
                </Badge>
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(addon)}
                    className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-sand-100"
                  >
                    Edit
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={addon.id} />
                    <SubmitButton quiet pendingLabel="…" confirm={`Delete “${addon.name}”?`}>
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Panel title={editing ? "Edit add-on" : "New add-on"}>
        <form onSubmit={memory.onSubmit} key={editing?.id ?? "new"} action={action} className="flex flex-col gap-4">
          <ActionFeedback state={state} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <div>
            <label htmlFor="name" className="text-sm font-medium text-ink">Name</label>
            <input id="name" name="name" defaultValue={memory.text("name", editing?.name)} required className={`${adminInput} mt-1`} />
            <FieldError errors={state.errors?.name} />
          </div>

          <div>
            <label htmlFor="price" className="text-sm font-medium text-ink">Price (₱)</label>
            <input id="price" name="price" inputMode="decimal" defaultValue={memory.text("price", editing?.price)} required className={`${adminInput} mt-1`} />
            <FieldError errors={state.errors?.price} />
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-medium text-ink">Description</label>
            <textarea id="description" name="description" rows={2} defaultValue={memory.text("description", editing?.description)} className={`${adminInput} mt-1`} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Offered with</legend>
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
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input name="is_active" type="checkbox" defaultChecked={memory.checked("is_active", editing ? editing.is_active : true)} className="size-4 accent-burgundy-600" />
            Available to book
          </label>

          <div className="flex gap-2">
            <SubmitButton>{editing ? "Save changes" : "Add add-on"}</SubmitButton>
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
