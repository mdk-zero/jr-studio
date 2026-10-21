import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getNewBookingOptions } from "@/lib/admin-bookings";
import { PageHeader } from "@/components/admin/ui";
import { StaffBookingForm } from "@/components/admin/bookings/staff-booking-form";

export const metadata: Metadata = { title: "New booking" };

export default async function NewStaffBookingPage() {
  await requireStaff("/admin/bookings/new");
  const { packages, staff } = await getNewBookingOptions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New booking"
        description="For walk-ins and requests that come in by phone or message. Priced the same way as online bookings, and approved straight away."
      />
      <StaffBookingForm packages={packages} staff={staff} />
    </div>
  );
}
