import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reads the session or the link's parameters, so it renders per request. */
export const instant = false;

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  // Reaching here requires the session that /auth/confirm establishes, from a
  // recovery link or a staff invite.
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password");
  const { welcome } = await props.searchParams;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="caps text-brand">Password</p>
        <h1 className="mt-3 text-4xl leading-tight font-semibold text-heading">
          {welcome ? "Welcome! Set your password" : "Choose a new password"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {welcome ? "You'll sign in with " : "Setting a new password for "}
          <span className="font-medium text-ink">{user.email}</span>.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
