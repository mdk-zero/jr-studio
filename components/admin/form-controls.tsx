"use client";

import { useFormStatus } from "react-dom";

// The class strings live in a plain module: a Server Component that imports a
// constant from a "use client" file gets a client reference, not the string,
// and the filter bars on server-rendered pages silently lost their styling.
export { adminButton, adminButtonQuiet, adminInput } from "@/components/admin/styles";
import { adminButton, adminButtonQuiet } from "@/components/admin/styles";

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  quiet = false,
  className = "",
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  quiet?: boolean;
  className?: string;
  confirm?: string;
  /** Lets one form offer several actions: the pressed button's value is submitted. */
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons, only the one that was pressed shows progress.
  const isThisOne = pending && (!name || data?.get(name) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${quiet ? adminButtonQuiet : adminButton} ${className}`}
      onClick={
        confirm
          ? (event) => {
              // Destructive actions ask first. The legacy portfolio page deleted
              // on a single click, sometimes twice over.
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
    >
      {isThisOne ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
