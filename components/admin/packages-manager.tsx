"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deletePackage,
  savePackage,
  togglePackageActive,
  setPackageCover,
  type ActionState,
} from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { Badge, Panel, Table } from "@/components/admin/ui";
import { formatDuration } from "@/lib/datetime";
import { formatPeso } from "@/lib/money";
import { uploadImage } from "@/lib/storage-upload";
import { useFormMemory } from "@/components/forms/use-form-memory";

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
  const memory = useFormMemory(state);
  const [toggleState, toggleAction] = useActionState(togglePackageActive, initial);
  const [deleteState, deleteAction] = useActionState(deletePackage, initial);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_26rem]">
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
          <form onSubmit={memory.onSubmit} key={editing?.id ?? "new"} action={action} className="flex flex-col gap-4">
            <ActionFeedback state={state} />
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink">Name</label>
              <input id="name" name="name" defaultValue={memory.text("name", editing?.name)} required className={`${adminInput} mt-1`} />
              <FieldError errors={state.errors?.name} />
            </div>

            <div>
              <label htmlFor="category_id" className="text-sm font-medium text-ink">Category</label>
              <select
                id="category_id"
                name="category_id"
                defaultValue={memory.text("category_id", editing?.category_id)}
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
                  defaultValue={memory.text("price", editing?.price)}
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
                  defaultValue={memory.text("duration_minutes", editing?.duration_minutes ?? 60)}
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
                defaultValue={memory.text("description", editing?.description)}
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
                defaultValue={memory.text("inclusions", (editing?.inclusions ?? []).join("\n"))}
                placeholder={"One per line\n2 hours studio time\n15 edited photos"}
                className={`${adminInput} mt-1`}
              />
              <p className="mt-1 text-xs text-muted">One per line.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="outfits" className="text-sm font-medium text-ink">Outfits</label>
                <input id="outfits" name="outfits" type="number" min={0} defaultValue={memory.text("outfits", editing?.outfits)} className={`${adminInput} mt-1`} />
              </div>
              <div>
                <label htmlFor="backdrops" className="text-sm font-medium text-ink">Backdrops</label>
                <input id="backdrops" name="backdrops" type="number" min={0} defaultValue={memory.text("backdrops", editing?.backdrops)} className={`${adminInput} mt-1`} />
              </div>
            </div>

            <div>
              <label htmlFor="photos_included" className="text-sm font-medium text-ink">
                Photos included
              </label>
              <input
                id="photos_included"
                name="photos_included"
                defaultValue={memory.text("photos_included", editing?.photos_included)}
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
                      defaultChecked={memory.includes("addon_ids", addon.id, editing?.addonIds.includes(addon.id) ?? false)}
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
                <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={memory.text("sort_order", editing?.sort_order ?? 0)} className={`${adminInput} mt-1`} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="digital_images" type="checkbox" defaultChecked={memory.checked("digital_images", editing ? editing.digital_images : true)} className="size-4 accent-burgundy-600" />
                Digital copies included
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="magazine_cover" type="checkbox" defaultChecked={memory.checked("magazine_cover", editing?.magazine_cover ?? false)} className="size-4 accent-burgundy-600" />
                Magazine cover layout
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input name="is_active" type="checkbox" defaultChecked={memory.checked("is_active", editing ? editing.is_active : true)} className="size-4 accent-burgundy-600" />
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
            <CoverUploader key={editing.id} packageId={editing.id} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

/** Uploads straight to Storage from the browser, then records the path. */
function CoverUploader({ packageId }: { packageId: string }) {
  const [state, action] = useActionState(setPackageCover, initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Images must be 10MB or smaller.");
      return;
    }
    startTransition(async () => {
      try {
        const uploaded = await uploadImage("packages", packageId, file);
        const form = new FormData();
        form.set("id", packageId);
        form.set("path", uploaded.path);
        startTransition(() => action(form));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Upload failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <label className="inline-flex w-fit cursor-pointer items-center rounded-lg bg-burgundy-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-700">
        {pending ? "Uploading…" : "Choose an image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={pending}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      <p className="text-xs text-muted">
        JPG, PNG, WebP or AVIF, up to 10MB. Replaces the current cover and deletes the old file.
      </p>
    </div>
  );
}
