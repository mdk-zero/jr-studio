"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/catalog/actions";
import { SubmitButton } from "@/components/admin/form-controls";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A one-button form: hidden fields, one submit, its own result line. For the
 * many single actions in the back office (approve, mark read, deactivate)
 * that would otherwise each need their own client component.
 */
export function ActionButton({
  action,
  fields,
  children,
  pendingLabel = "…",
  confirm,
  quiet = true,
  className = "",
  feedback = "message",
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  pendingLabel?: string;
  confirm?: string;
  quiet?: boolean;
  className?: string;
  /** "error" shows only failures, for buttons whose effect is visible anyway. */
  feedback?: "message" | "error";
}) {
  const [state, formAction] = useActionState(action, {});
  const show = state.message && (feedback === "message" || !state.ok);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton quiet={quiet} pendingLabel={pendingLabel} confirm={confirm} className={className}>
        {children}
      </SubmitButton>
      {show ? (
        <span role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-burgundy-700" : "text-red-700"}`}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
