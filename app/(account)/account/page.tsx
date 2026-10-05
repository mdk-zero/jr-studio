import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "My bookings" };

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">
          Hello, {user?.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">Your bookings will appear here.</p>
      </div>
      <div className="rounded-xl border border-sand-300 bg-white p-6">
        <p className="text-sm text-muted">
          The booking flow is built in Phase 4. Until then you can browse the{" "}
          <Link href="/" className="text-burgundy-600 underline underline-offset-4">
            packages
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
