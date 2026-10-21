"use client";

import { useActionState, useState } from "react";
import { editTestimonialAction } from "@/app/admin/testimonials/actions";
import type { ActionState } from "@/app/admin/catalog/actions";
import { ActionFeedback, FieldError } from "@/components/admin/action-feedback";
import { SubmitButton, adminInput } from "@/components/admin/form-controls";
import { useFormMemory } from "@/components/forms/use-form-memory";

const initial: ActionState = {};

/** Corrections only: a typo, a phone number pasted into the text, a display name. */
export function EditReview({
  id,
  authorName,
  message,
  adminNotes,
}: {
  id: string;
  authorName: string;
  message: string;
  adminNotes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(editTestimonialAction, initial);
  const memory = useFormMemory(state);

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Edit
        </button>
        <ActionFeedback state={state} />
      </div>
    );
  }

  return (
    <form onSubmit={memory.onSubmit} action={action} className="flex w-full flex-col gap-3 rounded-lg bg-sand-50 p-4">
      <ActionFeedback state={state} />
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor={`author-${id}`} className="text-xs font-medium text-muted">Shown as</label>
        <input id={`author-${id}`} name="author_name" defaultValue={memory.text("author_name", authorName)} maxLength={80} className={`${adminInput} mt-1`} />
        <FieldError errors={state.errors?.author_name} />
      </div>
      <div>
        <label htmlFor={`message-${id}`} className="text-xs font-medium text-muted">Review</label>
        <textarea id={`message-${id}`} name="message" rows={4} defaultValue={memory.text("message", message)} maxLength={2000} className={`${adminInput} mt-1`} />
        <FieldError errors={state.errors?.message} />
      </div>
      <div>
        <label htmlFor={`notes-${id}`} className="text-xs font-medium text-muted">Studio notes (never shown publicly)</label>
        <textarea id={`notes-${id}`} name="admin_notes" rows={2} defaultValue={memory.text("admin_notes", adminNotes)} maxLength={1000} className={`${adminInput} mt-1`} />
      </div>
      <div className="flex gap-2">
        <SubmitButton quiet className="px-4 py-2 text-sm">Save</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink">
          Close
        </button>
      </div>
    </form>
  );
}
