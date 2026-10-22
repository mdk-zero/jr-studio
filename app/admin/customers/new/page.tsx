import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CustomerForm } from "@/components/admin/customers/customer-form";

export const metadata: Metadata = { title: "Add customer" };

/** Back office: reads the session and live data, so it renders per request. */
export const instant = false;

export default async function NewCustomerPage() {
  await requireStaff("/admin/customers/new");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Add customer"
        description="For walk-ins and people who book by phone or message. To book them straight away, use New booking instead; it can add the customer too."
      />
      <Panel>
        <CustomerForm />
      </Panel>
    </div>
  );
}
