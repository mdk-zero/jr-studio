import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  hasCredentials,
  packageIdBySlug,
  type Client,
} from "./helpers";

describe.skipIf(!hasCredentials)("RLS and the booking rules", () => {
  let customerA: { client: Client; userId: string; email: string };
  let customerB: { client: Client; userId: string; email: string };
  let staff: { client: Client; userId: string; email: string };
  let admin: { client: Client; userId: string; email: string };
  let selfStudio: string;
  const createdBookingIds: string[] = [];

  beforeAll(async () => {
    [customerA, customerB, staff, admin] = await Promise.all([
      createUser("customer", "cust-a"),
      createUser("customer", "cust-b"),
      createUser("staff", "staff"),
      createUser("admin", "admin"),
    ]);
    selfStudio = await packageIdBySlug("self-studio-solo");
  });

  afterAll(async () => {
    const db = adminClient();
    if (createdBookingIds.length) {
      await db.from("bookings").delete().in("id", createdBookingIds);
    }
    const emails = [customerA, customerB, staff, admin].map((u) => u.email);
    await db.from("customers").delete().in("email", emails);
    await Promise.all(
      [customerA, customerB, staff, admin].map((u) => deleteUser(u.userId)),
    );
  });

  // -------------------------------------------------------------------------
  // Account provisioning
  // -------------------------------------------------------------------------
  it("gives every confirmed signup a profile and a customer record", async () => {
    const { data: profile } = await customerA.client
      .from("profiles").select("role, email").eq("id", customerA.userId).single();
    expect(profile!.role).toBe("customer");

    // Requires the link_customer fix: these users are created pre-confirmed.
    const { data: customer } = await customerA.client
      .from("customers").select("id, profile_id").eq("profile_id", customerA.userId).single();
    expect(customer!.profile_id).toBe(customerA.userId);
  });

  // -------------------------------------------------------------------------
  // Privilege escalation
  // -------------------------------------------------------------------------
  it("stops a customer from promoting themselves to admin", async () => {
    const { error } = await customerA.client
      .from("profiles").update({ role: "admin" }).eq("id", customerA.userId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/only an admin can change a role/i);

    const { data } = await adminClient()
      .from("profiles").select("role").eq("id", customerA.userId).single();
    expect(data!.role).toBe("customer");
  });

  it("stops a customer from editing someone else's profile", async () => {
    const { data } = await customerA.client
      .from("profiles").update({ full_name: "Hacked" }).eq("id", customerB.userId).select();
    // RLS filters the row out, so nothing is updated.
    expect(data).toEqual([]);
    const { data: untouched } = await adminClient()
      .from("profiles").select("full_name").eq("id", customerB.userId).single();
    expect(untouched!.full_name).not.toBe("Hacked");
  });

  // -------------------------------------------------------------------------
  // Catalog writes
  // -------------------------------------------------------------------------
  it("lets only admins change the catalog", async () => {
    const { data: category } = await adminClient()
      .from("categories").select("id").limit(1).single();

    const payload = {
      category_id: category!.id,
      slug: `test-${Date.now()}`,
      name: "Unauthorized package",
      price: 1,
      duration_minutes: 30,
    };

    const asCustomer = await customerA.client.from("packages").insert(payload);
    expect(asCustomer.error).not.toBeNull();

    const asStaff = await staff.client.from("packages").insert(payload);
    expect(asStaff.error).not.toBeNull(); // staff run shoots, not pricing

    const asAdmin = await admin.client.from("packages").insert(payload).select("id").single();
    expect(asAdmin.error).toBeNull();
    await adminClient().from("packages").delete().eq("id", asAdmin.data!.id);
  });

  // -------------------------------------------------------------------------
  // Booking creation through the RPC
  // -------------------------------------------------------------------------
  async function firstOpenSlot(client: Client, dayOffset: number) {
    for (let d = dayOffset; d < dayOffset + 14; d++) {
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
        .format(new Date(Date.now() + d * 86400_000));
      const { data } = await client.rpc("available_slots", {
        p_package_id: selfStudio,
        p_date: date,
      });
      if (data && data.length > 0) return data[Math.floor(data.length / 2)];
    }
    throw new Error("no open slot found");
  }

  it("creates a booking priced by the server, not the client", async () => {
    const slot = await firstOpenSlot(customerA.client, 30);
    const { data, error } = await customerA.client.rpc("create_booking", {
      p_package_id: selfStudio,
      p_starts_at: slot.starts_at,
      p_notes: "Integration test booking",
    });
    expect(error).toBeNull();
    const booking = data as unknown as { id: string; total_amount: string; status: string; reference: string };
    createdBookingIds.push(booking.id);

    expect(booking.status).toBe("pending");
    expect(booking.reference).toMatch(/^JR-\d{5}$/);
    // Self Studio Solo is 350 with the active 15% promo -> 297.50.
    expect(Number(booking.total_amount)).toBe(297.5);
  });

  it("refuses a second booking in the same slot (the exclusion constraint)", async () => {
    const slot = await firstOpenSlot(customerA.client, 60);

    const first = await customerA.client.rpc("create_booking", {
      p_package_id: selfStudio,
      p_starts_at: slot.starts_at,
    });
    expect(first.error).toBeNull();
    createdBookingIds.push((first.data as unknown as { id: string }).id);

    // A different customer, the same slot: must be rejected, not silently
    // double-booked the way the legacy SELECT-then-INSERT check allowed.
    const second = await customerB.client.rpc("create_booking", {
      p_package_id: selfStudio,
      p_starts_at: slot.starts_at,
    });
    expect(second.error).not.toBeNull();
    expect(second.error!.code).toBe("23P01");
  });

  it("refuses a slot outside business hours", async () => {
    // 03:00 Manila = 19:00 UTC the previous day.
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
      .format(new Date(Date.now() + 40 * 86400_000));
    const { error } = await customerA.client.rpc("create_booking", {
      p_package_id: selfStudio,
      p_starts_at: `${date}T19:00:00.000Z`,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not available/i);
  });

  it("refuses a booking in the past", async () => {
    const { error } = await customerA.client.rpc("create_booking", {
      p_package_id: selfStudio,
      p_starts_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("blocks a direct insert into bookings, bypassing the RPC", async () => {
    // This is the legacy hole: posting your own amount. Customers hold no
    // INSERT privilege on bookings at all.
    const { data: customer } = await customerA.client
      .from("customers").select("id").eq("profile_id", customerA.userId).single();

    const { error } = await customerA.client.from("bookings").insert({
      customer_id: customer!.id,
      package_id: selfStudio,
      starts_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
      ends_at: new Date(Date.now() + 90 * 86400_000 + 900_000).toISOString(),
      package_price: 0,
      total_amount: 0, // a free booking, if this were allowed
      source: "customer",
    });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Booking visibility
  // -------------------------------------------------------------------------
  it("keeps bookings private between customers", async () => {
    const { data: mine } = await customerA.client.from("bookings").select("id");
    expect(mine!.length).toBeGreaterThan(0);
    expect(mine!.every((b) => createdBookingIds.includes(b.id))).toBe(true);

    // Customer B sees none of A's bookings, and none of the seeded ones.
    const { data: theirs } = await customerB.client.from("bookings").select("id");
    const leaked = (theirs ?? []).filter((b) => createdBookingIds.includes(b.id));
    expect(leaked).toEqual([]);
  });

  it("lets staff see every booking", async () => {
    const { data } = await staff.client.from("bookings").select("id");
    expect(data!.length).toBeGreaterThan(createdBookingIds.length);
  });

  it("hides payments from other customers but shows them to staff", async () => {
    const { data: asCustomerB } = await customerB.client.from("payments").select("id");
    expect(asCustomerB).toEqual([]);

    const { data: asStaff } = await staff.client.from("payments").select("id");
    expect(asStaff!.length).toBeGreaterThan(0);
  });

  it("stops a customer from recording a payment for themselves", async () => {
    const { error } = await customerA.client.from("payments").insert({
      booking_id: createdBookingIds[0],
      amount: 1000,
      method: "cash",
    });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Cancel and undo
  // -------------------------------------------------------------------------
  it("cancels a booking and allows an undo inside the window", async () => {
    const slot = await firstOpenSlot(customerA.client, 75);
    const created = await customerA.client.rpc("create_booking", {
      p_package_id: selfStudio,
      p_starts_at: slot.starts_at,
    });
    expect(created.error).toBeNull();
    const booking = created.data as unknown as { id: string };
    createdBookingIds.push(booking.id);

    const cancelled = await customerA.client.rpc("cancel_booking", {
      p_booking_id: booking.id,
    });
    expect(cancelled.error).toBeNull();
    expect((cancelled.data as unknown as { status: string }).status).toBe("cancelled");

    // Cancelling frees the slot for someone else.
    const slots = await customerA.client.rpc("available_slots", {
      p_package_id: selfStudio,
      p_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
        .format(new Date(slot.starts_at)),
    });
    expect(slots.data!.some((s) => s.starts_at === slot.starts_at)).toBe(true);

    const undone = await customerA.client.rpc("undo_cancel_booking", {
      p_booking_id: booking.id,
    });
    expect(undone.error).toBeNull();
    expect((undone.data as unknown as { status: string }).status).toBe("pending");
  });

  it("stops a customer from cancelling someone else's booking", async () => {
    const { error } = await customerB.client.rpc("cancel_booking", {
      p_booking_id: createdBookingIds[0],
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not found/i);
  });

  // -------------------------------------------------------------------------
  // Anonymous access
  // -------------------------------------------------------------------------
  it("lets visitors read the catalog but nothing private", async () => {
    const anon = anonClient();

    const { data: packages } = await anon.from("packages").select("id, name");
    expect(packages!.length).toBeGreaterThan(0);

    for (const table of ["bookings", "customers", "payments", "profiles"] as const) {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(error, `${table} must be denied to anon`).not.toBeNull();
    }
  });

  it("shows visitors only approved testimonials and active promotions", async () => {
    const anon = anonClient();

    const { data: testimonials } = await anon.from("testimonials").select("status");
    expect(testimonials!.length).toBeGreaterThan(0);
    expect(testimonials!.every((t) => t.status === "approved")).toBe(true);

    const { data: promos } = await anon.from("promotions_with_status").select("name, status");
    expect(promos!.length).toBeGreaterThan(0);
    // Upcoming and expired promotions must not leak to the public site, which
    // is exactly what the legacy stale-status column got wrong.
    expect(promos!.every((p) => p.status === "active")).toBe(true);
  });
});
