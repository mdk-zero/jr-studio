import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { listStaff } from "@/lib/admin-people";
import { storageUrl } from "@/lib/catalog";
import { PageHeader } from "@/components/admin/ui";
import { StaffManager } from "@/components/admin/staff/staff-manager";

export const metadata: Metadata = { title: "Staff" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default async function StaffPage() {
  const user = await requireAdmin("/admin/staff");
  const staff = await listStaff();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description="The team: who can be assigned to sessions, who appears on the About page, and who can sign in to the back office."
      />
      <StaffManager
        currentUserId={user.id}
        staff={staff.map((s) => ({ ...s, photoUrl: storageUrl("staff", s.photo_path) }))}
      />
    </div>
  );
}
