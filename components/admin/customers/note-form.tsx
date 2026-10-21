"use client";

import { useActionState } from "react";
import { addNoteAction } from "@/app/admin/customers/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";

const initial: ActionState = {};

export function NoteForm({ customerId }: { customerId: string }) {
  const [state, action] = useActionState(addNoteAction, initial);

  return (
    <form action={action} className="flex flex-col gap-2">
      <ActionFeedback state={state} />
      <input type="hidden" name="customer_id" value={customerId} />
      <label htmlFor="note-body" className="sr-only">New note</label>
      <textarea
        id="note-body"
        name="body"
        rows={3}
        maxLength={2000}
        placeholder="e.g. Prefers morning slots. Allergic to certain makeup brands."
        className={adminInput}
      />
      <FieldError errors={state.errors?.body} />
      <p className="text-xs text-muted">Staff only. Customers never see these.</p>
      <div>
        <SubmitButton quiet className="px-4 py-2 text-sm" pendingLabel="Adding…">Add note</SubmitButton>
      </div>
    </form>
  );
}
