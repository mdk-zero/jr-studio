import Link from "next/link";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your email and we will send you a link to choose a new password.
        </p>
      </div>

      <ForgotPasswordForm />

      <Link href="/login" className="text-sm text-burgundy-600 underline underline-offset-4">
        Back to sign in
      </Link>
    </div>
  );
}
