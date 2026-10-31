"use client";

import type { ActionState } from "@/app/admin/catalog/actions";

export function ActionFeedback({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "rounded-lg bg-tint px-3 py-2 text-sm text-on-tint"
          : "rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger"
      }
    >
      {state.message}
    </p>
  );
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-danger">
      {errors[0]}
    </p>
  );
}
