import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const metadata: Metadata = { title: "Book a session" };

/** Reads the session to gate the flow, so it renders per request. */
export const instant = false;

export default async function BookPage(props: PageProps<"/book">) {
  await requireUser("/book");
  const { package: packageParam } = await props.searchParams;

  const supabase = await createClient();
  const [{ data: packages }, { data: links }, { data: addons }, { data: settings }] =
    await Promise.all([
      supabase
        .from("packages")
        .select("id, slug, name, price, duration_minutes, categories(name)")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("package_addons").select("package_id, addon_id"),
      supabase.from("addons").select("id, name, price, is_active").eq("is_active", true),
      supabase.from("studio_settings").select("max_advance_days").single(),
    ]);

  const options = (packages ?? []).map((pkg) => ({
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    price: pkg.price,
    duration_minutes: pkg.duration_minutes,
    category: pkg.categories?.name ?? "",
    // Only the add-ons actually offered with this package; quote_booking
    // enforces the same rule server-side.
    addons: (links ?? [])
      .filter((l) => l.package_id === pkg.id)
      .flatMap((l) => {
        const addon = (addons ?? []).find((a) => a.id === l.addon_id);
        return addon ? [{ id: addon.id, name: addon.name, price: addon.price }] : [];
      }),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12">
      <header className="border-b border-burgundy-600/20 pb-6">
        <p className="caps text-burgundy-500">Book a session</p>
        <h1 className="font-display mt-3 text-4xl font-semibold text-burgundy-700">
          Let&apos;s get you in the studio
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Times shown are the ones genuinely free. Your request goes to the studio for
          confirmation — nothing is charged here.
        </p>
      </header>

      {options.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          No packages are available right now. Please{" "}
          <Link href="/" className="text-burgundy-600 underline underline-offset-4">
            check back soon
          </Link>
          .
        </p>
      ) : (
        <div className="mt-10">
          <BookingWizard
            packages={options}
            preselectedSlug={typeof packageParam === "string" ? packageParam : undefined}
            maxAdvanceDays={settings?.max_advance_days ?? 90}
          />
        </div>
      )}
    </div>
  );
}
