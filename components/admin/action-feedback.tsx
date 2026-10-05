"use client";

import type { ActionState } from "@/app/admin/catalog/actions";

export function ActionFeedback({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "rounded-lg bg-burgundy-50 px-3 py-2 text-sm text-burgundy-700"
          : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
      }
    >
      {state.message}
    </p>
  );
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-red-700">
      {errors[0]}
    </p>
  );
}
