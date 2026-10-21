"use client";

import { useActionState, useState } from "react";
import { deleteCategory, saveCategory, type ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { Badge, Panel, Table } from "@/components/admin/ui";
import { useFormMemory } from "@/components/forms/use-form-memory";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  packageCount: number;
};

const initial: ActionState = {};

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [state, action] = useActionState(saveCategory, initial);
  const memory = useFormMemory(state);
  const [deleteState, deleteAction] = useActionState(deleteCategory, initial);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-3">
        <ActionFeedback state={deleteState} />
        <Table
          head={
            <>
              <th>Category</th>
              <th>Packages</th>
              <th>Order</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </>
          }
        >
          {categories.map((category) => (
            <tr key={category.id}>
              <td>
                <p className="font-medium text-ink">{category.name}</p>
                <p className="text-xs text-muted">/{category.slug}</p>
              </td>
              <td className="text-muted">{category.packageCount}</td>
              <td className="text-muted">{category.sort_order}</td>
              <td>
                <Badge tone={category.is_active ? "on" : "off"}>
                  {category.is_active ? "Visible" : "Hidden"}
                </Badge>
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(category)}
                    className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-sand-100"
                  >
                    Edit
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <SubmitButton
                      quiet
                      pendingLabel="…"
                      confirm={`Delete “${category.name}”? Packages in it must be moved first.`}
                    >
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Panel title={editing ? "Edit category" : "New category"}>
        {/* key resets the uncontrolled inputs when switching rows. */}
        <form onSubmit={memory.onSubmit} key={editing?.id ?? "new"} action={action} className="flex flex-col gap-4">
          <ActionFeedback state={state} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <div>
            <label htmlFor="name" className="text-sm font-medium text-ink">
              Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={memory.text("name", editing?.name)}
              required
              className={`${adminInput} mt-1`}
            />
            <FieldError errors={state.errors?.name} />
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={memory.text("description", editing?.description)}
              className={`${adminInput} mt-1`}
            />
          </div>

          <div>
            <label htmlFor="sort_order" className="text-sm font-medium text-ink">
              Sort order
            </label>
            <input
              id="sort_order"
              name="sort_order"
              type="number"
              min={0}
              defaultValue={memory.text("sort_order", editing?.sort_order ?? 0)}
              className={`${adminInput} mt-1`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={memory.checked("is_active", editing ? editing.is_active : true)}
              className="size-4 accent-burgundy-600"
            />
            Show on the public site
          </label>

          <div className="flex gap-2">
            <SubmitButton>{editing ? "Save changes" : "Add category"}</SubmitButton>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-ink transition hover:bg-sand-100"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}
