import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name, phone, address, marketing_opt_in")
    .eq("profile_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-burgundy-700">Your profile</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as {user.email}. Contact the studio to change your email address.
        </p>
      </header>

      <div className="max-w-md border border-sand-300 bg-white p-6">
        <ProfileForm
          fullName={customer?.full_name ?? user.fullName}
          phone={customer?.phone ?? ""}
          address={customer?.address ?? ""}
          marketingOptIn={customer?.marketing_opt_in ?? false}
        />
      </div>
    </div>
  );
}
