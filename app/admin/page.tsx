import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const user = await requireStaff("/admin");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-burgundy-700">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as {user.email} ({user.role}).
        </p>
      </div>
      <p className="rounded-xl border border-sand-300 bg-white p-6 text-sm text-muted">
        Metrics arrive in Phase 7, once bookings and the payment ledger have screens of their own.
      </p>
    </div>
  );
}
