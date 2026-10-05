import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/dal";
import { homePathFor } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          You will need an account to book a session and see your booking history.
        </p>
      </div>

      <SignUpForm />

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-burgundy-600 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
