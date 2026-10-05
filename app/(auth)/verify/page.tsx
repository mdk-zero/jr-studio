import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyPage(props: PageProps<"/verify">) {
  const { email } = await props.searchParams;
  if (typeof email !== "string" || !email) redirect("/signup");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Confirm your email</h1>
        <p className="mt-1 text-sm text-muted">
          We sent a message to <span className="font-medium text-ink">{email}</span>. Enter the code
          below, or just click the link in the email.
        </p>
      </div>

      <VerifyForm email={email} />

      <p className="text-sm text-muted">
        Wrong address?{" "}
        <Link href="/signup" className="font-medium text-burgundy-600 underline underline-offset-4">
          Start again
        </Link>
      </p>
    </div>
  );
}
