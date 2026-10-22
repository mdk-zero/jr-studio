import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = { title: "Confirm your email" };

/** Reads the session or the link's parameters, so it renders per request. */
export const instant = false;

export default async function VerifyPage(props: PageProps<"/verify">) {
  const { email } = await props.searchParams;
  if (typeof email !== "string" || !email) redirect("/signup");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Confirm your email</h1>
        <p className="mt-1 text-sm text-muted">
          We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. Enter it
          below to finish creating your account.
        </p>
      </div>

      <VerifyForm email={email} />

      {/* Supabase sends nothing, and says nothing, when the address already
          has an account (so the form cannot reveal who is registered). Say
          what to do instead, without saying which case this is. */}
      <div className="flex flex-col gap-2 text-sm text-muted">
        <p>
          No email after a few minutes? Check your spam or promotions folder, or send a new code above.
        </p>
        <p>
          Already have an account with this email? No code is sent in that case.{" "}
          <Link href="/login" className="font-medium text-burgundy-600 underline underline-offset-4">
            Sign in
          </Link>{" "}
          or{" "}
          <Link href="/forgot-password" className="font-medium text-burgundy-600 underline underline-offset-4">
            reset your password
          </Link>
          .
        </p>
        <p>
          Wrong address?{" "}
          <Link href="/signup" className="font-medium text-burgundy-600 underline underline-offset-4">
            Start again
          </Link>
        </p>
      </div>
    </div>
  );
}
