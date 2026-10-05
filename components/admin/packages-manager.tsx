"use client";

import { useActionState, useState } from "react";
import {
  deletePackage,
  savePackage,
  togglePackageActive,
  uploadPackageCover,
  type ActionState,
} from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { Badge, Panel, Table } from "@/components/admin/ui";
import { formatDuration } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";

type Addon = { id: string; name: string; price: number };

type PackageRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  inclusions: string[];
  outfits: number | null;
  backdrops: number | null;
  photos_included: string | null;
  magazine_cover: boolean;
  digital_images: boolean;
  is_active: boolean;
  sort_order: number;
  category_id: string;
  cover_path: string | null;
  addonIds: string[];
  bookingCount: number;
};

const initial: ActionState = {};

export function PackagesManager({
  packages,
  categories,
  addons,
}: {
  packages: PackageRow[];
  categories: Array<{ id: string; name: string }>;
  addons: Addon[];
}) {
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [state, action] = useActionState(savePackage, initial);
  const [toggleState, toggleAction] = useActionState(togglePackageActive, initial);
  const [deleteState, deleteAction] = useActionState(deletePackage, initial);
  const [coverState, coverAction] = useActionState(uploadPackageCover, initial);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
      <div className="flex flex-col gap-3">
        <ActionFeedback state={toggleState} />
        <ActionFeedback state={deleteState} />

        <Table
          head={
            <>
              <th>Package</th>
              <th>Price</th>
              <th>Duration</th>
              <th>Bookings</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </>
          }
        >
          {packages.map((pkg) => (
            <tr key={pkg.id} className={editing?.id === pkg.id ? "bg-sand-50" : undefined}>
              <td>
                <p className="font-medium text-ink">{pkg.name}</p>
                <p className="text-xs text-muted">
                  {categories.find((c) => c.id === pkg.category_id)?.name ?? "—"}
                  {pkg.cover_path ? " · cover set" : ""}
                </p>
              </td>
              <td className="nums text-ink">{formatPeso(pkg.price)}</td>
              <td className="nums text-muted">{formatDuration(pkg.duration_minutes)}</td>
              <td className="nums text-muted">{pkg.bookingCount}</td>
              <td>
                <form action={toggleAction}>
                  <input type="hidden" name="id" value={pkg.id} />
                  <button type="submit" className="cursor-pointer" title="Toggle visibility">
                    <Badge tone={pkg.is_active ? "on" : "off"}>
                      {pkg.is_active ? "Live" : "Hidden"}
                    </Badge>
                  </button>
                </form>
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(pkg)}
                    className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-sand-100"
                  >
                    Edit
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={pkg.id} />
                    <SubmitButton
                      quiet
                      pendingLabel="…"
                      confirm={
                        pkg.bookingCount > 0
                          ? `“${pkg.name}” has ${pkg.bookingCount} booking(s) and cannot be deleted. Hide it instead?`
                          : `Delete “${pkg.name}”?`
                      }
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

      <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <Panel title={editing ? `Edit: ${editing.name}` : "New package"}>
          <form key={editing?.id ?? "new"} action={action} className="flex flex-col gap-4">
            <ActionFeedback state={state} />
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink">Name</label>
              <input id="name" name="name" defaultValue={editing?.name ?? ""} required className={`${adminInput} mt-1`} />
              <FieldError errors={state.errors?.name} />
            </div>

            <div>
              <label htmlFor="category_id" className="text-sm font-medium text-ink">Category</label>
              <select
                id="category_id"
                name="category_id"
                defaultValue={editing?.category_id ?? ""}
                required
                className={`${adminInput} mt-1`}
              >
                <option value="" disabled>Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <FieldError errors={state.errors?.category_id} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="price" className="text-sm font-medium text-ink">Price (₱)</label>
                <input
                  id="price"
                  name="price"
                  inputMode="decimal"
                  defaultValue={editing?.price ?? ""}
                  required
                  className={`${adminInput} mt-1`}
                />
                <FieldError errors={state.errors?.price} />
              </div>
              <div>
                <label htmlFor="duration_minutes" className="text-sm font-medium text-ink">
                  Duration (minutes)
                </label>
                <input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={editing?.duration_minutes ?? 60}
                  required
                  className={`${adminInput} mt-1`}
                />
                <FieldError errors={state.errors?.duration_minutes} />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="text-sm font-medium text-ink">Description</label>
              <textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description ?? ""}
                className={`${adminInput} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="inclusions" className="text-sm font-medium text-ink">
                Inclusions
              </label>
              <textarea
                id="inclusions"
                name="inclusions"
                rows={4}
                defaultValue={(editing?.inclusions ?? []).join("\n")}
                placeholder={"One per line\n2 hours studio time\n15 edited photos"}
                className={`${adminInput} mt-1`}
              />
              <p className="mt-1 text-xs text-muted">One per line.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="outfits" className="text-sm font-medium text-ink">Outfits</label>
                <input id="outfits" name="outfits" type="number" min={0} defaultValue={editing?.outfits ?? ""} className={`${adminInput} mt-1`} />
              </div>
              <div>
                <label htmlFor="backdrops" className="text-sm font-medium text-ink">Backdrops</label>
                <input id="backdrops" name="backdrops" type="number" min={0} defaultValue={editing?.backdrops ?? ""} className={`${adminInput} mt-1`} />
              </div>
            </div>

            <div>
              <label htmlFor="photos_included" className="text-sm font-medium text-ink">
                Photos included
              </label>
              <input
                id="photos_included"
                name="photos_included"
                defaultValue={editing?.photos_included ?? ""}
                placeholder="e.g. 15 edited"
                className={`${adminInput} mt-1`}
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-ink">Add-ons offered</legend>
              <p className="text-xs text-muted">
                Only these can be chosen with this package while booking.
              </p>
              <div className="mt-1 flex flex-col gap-1.5">
                {addons.map((addon) => (
                  <label key={addon.id} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="addon_ids"
                      value={addon.id}
                      defaultChecked={editing?.addonIds.includes(addon.id) ?? false}
                      className="size-4 accent-burgundy-600"
                    />
                    <span className="flex-1">{addon.name}</span>
                    <span className="nums text-xs text-muted">{formatPeso(addon.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sort_order" className="text-sm font-medium text-ink">Sort order</label>
                <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={editing?.sort_order ?? 0} className={`${adminInput} mt-1`} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="digital_images" type="checkbox" defaultChecked={editing ? editing.digital_images : true} className="size-4 accent-burgundy-600" />
                Digital copies included
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="magazine_cover" type="checkbox" defaultChecked={editing?.magazine_cover ?? false} className="size-4 accent-burgundy-600" />
                Magazine cover layout
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="is_active" type="checkbox" defaultChecked={editing ? editing.is_active : true} className="size-4 accent-burgundy-600" />
                Show on the public site
              </label>
            </div>

            <div className="flex gap-2">
              <SubmitButton>{editing ? "Save changes" : "Add package"}</SubmitButton>
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

        {editing ? (
          <Panel title="Cover image">
            <form action={coverAction} className="flex flex-col gap-3">
              <ActionFeedback state={coverState} />
              <input type="hidden" name="id" value={editing.id} />
              <input
                type="file"
                name="cover"
                accept="image/*"
                required
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-sand-200 file:px-3 file:py-1.5 file:text-sm file:text-ink"
              />
              <p className="text-xs text-muted">
                JPG, PNG, WebP or AVIF, up to 10MB. Replaces the current cover and deletes the old file.
              </p>
              <SubmitButton pendingLabel="Uploading…">Upload cover</SubmitButton>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
