import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Reaching here requires the recovery session that /auth/confirm establishes.
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">
          Setting a new password for <span className="font-medium text-ink">{user.email}</span>.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
