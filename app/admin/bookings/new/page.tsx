import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getActiveCustomer, getNewBookingOptions } from "@/lib/admin-bookings";
import { PageHeader } from "@/components/admin/ui";
import { StaffBookingForm } from "@/components/admin/bookings/staff-booking-form";

export const metadata: Metadata = { title: "New booking" };

export default async function NewStaffBookingPage(props: PageProps<"/admin/bookings/new">) {
  await requireStaff("/admin/bookings/new");
  const { customer: customerId } = await props.searchParams;
  const [{ packages, staff }, customer] = await Promise.all([
    getNewBookingOptions(),
    typeof customerId === "string" && /^[0-9a-f-]{36}$/i.test(customerId)
      ? getActiveCustomer(customerId)
      : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New booking"
        description="For walk-ins and requests that come in by phone or message. Priced the same way as online bookings, and approved straight away."
      />
      <StaffBookingForm packages={packages} staff={staff} initialCustomer={customer} />
    </div>
  );
}
