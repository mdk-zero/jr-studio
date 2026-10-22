import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { FormMessage } from "@/components/auth/form-message";
import { getCurrentUser } from "@/lib/dal";
import { homePathFor, safeNextPath } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Sign in" };

/** Reads the session or the link's parameters, so it renders per request. */
export const instant = false;

const linkErrors: Record<string, string> = {
  invalid_link: "That link was not valid. Try signing in instead.",
  expired_link: "That link has expired. Request a new one.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;

  // Already signed in: no reason to show a login form.
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  const message = typeof error === "string" ? linkErrors[error] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to manage your bookings.</p>
      </div>

      <FormMessage message={message} />
      <LoginForm next={nextPath ?? undefined} />

      <div className="flex flex-col gap-2 text-sm text-muted">
        <Link href="/forgot-password" className="text-burgundy-600 underline underline-offset-4">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/signup" className="font-medium text-burgundy-600 underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
