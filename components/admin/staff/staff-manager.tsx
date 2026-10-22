"use client";

import { useActionState, useState, useTransition } from "react";
import {
  resendInviteAction,
  saveStaffAction,
  setStaffAccessAction,
  setStaffPhotoAction,
  setStaffStatusAction,
  type StaffState,
} from "@/app/admin/staff/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import type { StaffAccess, StaffRow } from "@/lib/admin-people";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { Badge, Panel, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-button";
import { STAFF_POSITIONS } from "@/lib/validators/people";
import { POSITION_LABEL } from "@/lib/people-labels";
import { uploadImage } from "@/lib/storage-upload";
import { formatManilaDate } from "@/lib/datetime";
import { useFormMemory } from "@/components/forms/use-form-memory";

type Member = StaffRow & { photoUrl: string | null };

const initial: ActionState = {};

function accessLabel(access: StaffAccess): { text: string; tone: "on" | "off" | "info" } {
  switch (access.kind) {
    case "active":
      return { text: access.role === "admin" ? "Admin login" : "Staff login", tone: "on" };
    case "invited":
      return { text: `Invited (${access.role})`, tone: "info" };
    case "revoked":
      return { text: "Access removed", tone: "off" };
    default:
      return { text: "No login", tone: "off" };
  }
}

export function StaffManager({ staff, currentUserId }: { staff: Member[]; currentUserId: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = staff.find((s) => s.id === editingId) ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_24rem]">
      <Table
        head={
          <>
            <th>Name</th>
            <th>Contact</th>
            <th>Back office</th>
            <th className="text-right">Actions</th>
          </>
        }
      >
        {staff.map((member) => {
          const access = accessLabel(member.access);
          return (
            <tr key={member.id} className={member.status === "inactive" ? "opacity-60" : ""}>
              <td>
                <div className="flex items-center gap-3">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                    <img src={member.photoUrl} alt="" className="size-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-sand-200 text-xs font-semibold text-muted">
                      {member.full_name.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-ink">{member.full_name}</p>
                    <p className="text-xs text-muted">
                      {POSITION_LABEL[member.position]}
                      {member.status === "inactive" ? " · inactive" : ""}
                      {member.show_on_about ? " · on About page" : ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="text-muted">
                <span className="block break-words">{member.email ?? "—"}</span>
                {member.phone ? <span className="nums block text-xs">{member.phone}</span> : null}
              </td>
              <td>
                <Badge tone={access.tone}>{access.text}</Badge>
              </td>
              <td className="text-right">
                <button
                  type="button"
                  onClick={() => setEditingId(member.id)}
                  className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-sand-100"
                >
                  Manage
                </button>
              </td>
            </tr>
          );
        })}
      </Table>

      <div className="flex flex-col gap-6">
        <Panel title={editing ? editing.full_name : "Add someone"}>
          <StaffForm key={editing?.id ?? "new"} member={editing} onCancel={() => setEditingId(null)} />
        </Panel>

        {editing ? (
          <>
            <Panel title="Back-office login">
              <AccessPanel key={`access-${editing.id}`} member={editing} isSelf={editing.profile_id === currentUserId} />
            </Panel>
            <Panel title="Photo">
              <PhotoPanel key={`photo-${editing.id}`} member={editing} />
            </Panel>
            <Panel title="Status">
              {editing.profile_id === currentUserId ? (
                <p className="text-sm text-muted">This is you. Another admin would have to deactivate you.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted">
                    {editing.status === "active"
                      ? "Inactive staff can't be assigned to sessions, leave the About page, and lose any login at once."
                      : "Reactivating does not restore a login; give access again if they need it."}
                  </p>
                  <ActionButton
                    action={setStaffStatusAction}
                    fields={{ staff_id: editing.id, status: editing.status === "active" ? "inactive" : "active" }}
                    confirm={editing.status === "active" ? `Deactivate ${editing.full_name}?` : undefined}
                    className="px-4 py-2 text-sm"
                  >
                    {editing.status === "active" ? "Deactivate" : "Reactivate"}
                  </ActionButton>
                </>
              )}
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StaffForm({ member, onCancel }: { member: Member | null; onCancel: () => void }) {
  const [state, action] = useActionState(saveStaffAction, initial);
  const memory = useFormMemory(state);

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex flex-col gap-4">
      <ActionFeedback state={state} />
      {member ? <input type="hidden" name="id" value={member.id} /> : null}

      <div>
        <label htmlFor="full_name" className="text-sm font-medium text-ink">Name</label>
        <input id="full_name" name="full_name" required defaultValue={memory.text("full_name", member?.full_name)} className={`${adminInput} mt-1`} />
        <FieldError errors={state.errors?.full_name} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="position" className="text-sm font-medium text-ink">Role</label>
          <select id="position" name="position" defaultValue={memory.text("position", member?.position ?? "photographer")} className={`${adminInput} mt-1`}>
            {STAFF_POSITIONS.map((p) => (
              <option key={p} value={p}>{POSITION_LABEL[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort_order" className="text-sm font-medium text-ink">Order</label>
          <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={memory.text("sort_order", member?.sort_order ?? 0)} className={`${adminInput} mt-1`} />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
        <input id="email" name="email" type="email" defaultValue={memory.text("email", member?.email)} className={`${adminInput} mt-1`} />
        <p className="mt-1 text-xs text-muted">Needed to invite them to sign in.</p>
        <FieldError errors={state.errors?.email} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="text-sm font-medium text-ink">Mobile</label>
          <input id="phone" name="phone" inputMode="tel" defaultValue={memory.text("phone", member?.phone)} className={`${adminInput} nums mt-1`} />
          <FieldError errors={state.errors?.phone} />
        </div>
        <div>
          <label htmlFor="hire_date" className="text-sm font-medium text-ink">Started</label>
          <input id="hire_date" name="hire_date" type="date" defaultValue={memory.text("hire_date", member?.hire_date)} className={`${adminInput} mt-1`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="birthday" className="text-sm font-medium text-ink">Birthday</label>
          <input id="birthday" name="birthday" type="date" defaultValue={memory.text("birthday", member?.birthday)} className={`${adminInput} mt-1`} />
        </div>
        <div>
          <label htmlFor="address" className="text-sm font-medium text-ink">Address</label>
          <input id="address" name="address" defaultValue={memory.text("address", member?.address)} className={`${adminInput} mt-1`} />
        </div>
      </div>

      <div>
        <label htmlFor="bio" className="text-sm font-medium text-ink">Short bio</label>
        <textarea id="bio" name="bio" rows={3} maxLength={600} defaultValue={memory.text("bio", member?.bio)} className={`${adminInput} mt-1`} />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input name="show_on_about" type="checkbox" defaultChecked={memory.checked("show_on_about", member?.show_on_about ?? false)} className="size-4 accent-burgundy-600" />
        Show on the About page
      </label>

      <div className="flex gap-2">
        <SubmitButton>{member ? "Save" : "Add to team"}</SubmitButton>
        {member ? (
          <button type="button" onClick={onCancel} className="rounded-lg border border-sand-300 px-4 py-2 text-sm text-ink transition hover:bg-sand-100">
            Close
          </button>
        ) : null}
      </div>
    </form>
  );
}

function InviteLink({ state }: { state: StaffState }) {
  if (!state.inviteLink) return null;
  return (
    <div className="rounded-lg bg-sand-50 p-3">
      <label htmlFor="invite-link" className="text-xs font-medium text-muted">Invite link (works once, for one hour)</label>
      <input
        id="invite-link"
        readOnly
        value={state.inviteLink}
        onFocus={(e) => e.currentTarget.select()}
        className={`${adminInput} mt-1 font-mono text-xs`}
      />
    </div>
  );
}

function AccessPanel({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [state, action] = useActionState(setStaffAccessAction, {} as StaffState);
  const [resendState, resend] = useActionState(resendInviteAction, {} as StaffState);
  const access = member.access;

  if (isSelf) {
    return <p className="text-sm text-muted">This is your own login. Another admin can change it.</p>;
  }

  const current = access.kind === "active" || access.kind === "invited" ? access.role : "none";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {access.kind === "active"
          ? `Signs in as ${access.role}.${access.lastSignIn ? ` Last signed in ${formatManilaDate(access.lastSignIn)}.` : ""}`
          : access.kind === "invited"
            ? `Invited${access.invitedAt ? ` on ${formatManilaDate(access.invitedAt)}` : ""}; not accepted yet.`
            : access.kind === "revoked"
              ? "Has an account, but no back-office access."
              : member.email
                ? `No login yet. Giving access emails an invite to ${member.email}.`
                : "Add an email address above to invite them."}
      </p>

      <form action={action} className="flex flex-col gap-3">
        <ActionFeedback state={state} />
        <InviteLink state={state} />
        <input type="hidden" name="staff_id" value={member.id} />
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="role" className="text-xs font-medium text-muted">Access</label>
            {/* Keyed so it shows the new access after a change, not what it had at mount. */}
            <select key={current} id="role" name="role" defaultValue={current} className={`${adminInput} mt-1 w-auto`}>
              <option value="none">No access</option>
              <option value="staff">Staff: bookings, customers, reviews, portfolio</option>
              <option value="admin">Admin: everything, including settings and staff</option>
            </select>
          </div>
          <SubmitButton quiet className="px-4 py-2 text-sm" pendingLabel="Saving…">
            {member.profile_id ? "Change access" : "Give access"}
          </SubmitButton>
        </div>
      </form>

      {access.kind === "invited" ? (
        <form action={resend} className="flex flex-col gap-2">
          <ActionFeedback state={resendState} />
          <InviteLink state={resendState} />
          <input type="hidden" name="staff_id" value={member.id} />
          <div>
            <SubmitButton quiet className="px-4 py-2 text-sm" pendingLabel="Sending…">
              Send a new invite link
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function PhotoPanel({ member }: { member: Member }) {
  const [state, action] = useActionState(setStaffPhotoAction, initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    // The staff bucket refuses anything larger; say so before uploading.
    if (file.size > 5 * 1024 * 1024) {
      setError(`${file.name} is over 5MB. Use a smaller copy of the photo.`);
      return;
    }
    startTransition(async () => {
      try {
        const uploaded = await uploadImage("staff", member.id, file);
        const form = new FormData();
        form.set("staff_id", member.id);
        form.set("path", uploaded.path);
        // After an await the outer transition has ended, so the dispatch gets
        // its own; the result lands in this panel's action state.
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
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file
        <img src={member.photoUrl} alt={member.full_name} className="aspect-square w-32 rounded-lg object-cover" />
      ) : (
        <p className="text-sm text-muted">No photo yet. Shown on the About page when they appear there.</p>
      )}
      <label className="inline-flex w-fit cursor-pointer items-center rounded-lg border border-sand-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand-100">
        {pending ? "Uploading…" : member.photoUrl ? "Replace photo" : "Upload photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={pending}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      <p className="text-xs text-muted">JPEG, PNG, WebP or AVIF, up to 5MB. A square crop looks best.</p>
    </div>
  );
}
