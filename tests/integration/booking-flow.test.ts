import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createUser,
  deleteUser,
  hasCredentials,
  packageIdBySlug,
  type Client,
} from "./helpers";

/**
 * The customer booking journey end to end, through the same RPCs the UI calls.
 */
describe.skipIf(!hasCredentials)("booking flow", () => {
  let customer: { client: Client; userId: string; email: string };
  let other: { client: Client; userId: string; email: string };
  let packageId: string;
  let hmuaId: string;
  const bookingIds: string[] = [];

  beforeAll(async () => {
    [customer, other] = await Promise.all([
      createUser("customer", "book-a"),
      createUser("customer", "book-b"),
    ]);
    packageId = await packageIdBySlug("pro-portraits");
    const { data } = await adminClient().from("addons").select("id, name");
    hmuaId = data!.find((a) => a.name === "Hair and Makeup")!.id;
  });

  afterAll(async () => {
    const db = adminClient();
    if (bookingIds.length) await db.from("bookings").delete().in("id", bookingIds);
    await db.from("customers").delete().in("email", [customer.email, other.email]);
    await Promise.all([deleteUser(customer.userId), deleteUser(other.userId)]);
  });

  /**
   * The first offered slot at least `fromDays` out. Offsets stay inside the
   * studio's max_advance_days window (90 by default), beyond which
   * available_slots correctly returns nothing.
   */
  async function openSlot(client: Client, fromDays: number) {
    for (let d = fromDays; d < fromDays + 10; d++) {
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
        new Date(Date.now() + d * 86400_000),
      );
      const { data } = await client.rpc("available_slots", {
        p_package_id: packageId,
        p_date: date,
      });
      if (data && data.length) return data[0];
    }
    throw new Error("no slot found");
  }

  it("books a session priced by the server, with add-on lines recorded", async () => {
    const slot = await openSlot(customer.client, 30);

    const { data, error } = await customer.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
      p_addon_ids: [hmuaId],
      p_notes: "Integration test",
    });
    expect(error).toBeNull();

    const booking = data as unknown as {
      id: string;
      status: string;
      total_amount: string;
      package_price: string;
      addons_total: string;
      discount_amount: string;
      ends_at: string;
    };
    bookingIds.push(booking.id);

    // Pro Portraits 600 + HMUA 1500 = 2100, less the active 15% promo.
    expect(Number(booking.package_price)).toBe(600);
    expect(Number(booking.addons_total)).toBe(1500);
    expect(Number(booking.discount_amount)).toBe(315);
    expect(Number(booking.total_amount)).toBe(1785);
    expect(booking.status).toBe("pending");

    // ends_at comes from the package duration, not from anything posted.
    const minutes = (new Date(booking.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60000;
    expect(minutes).toBe(30);

    const { data: lines } = await adminClient()
      .from("booking_addons")
      .select("quantity, unit_price")
      .eq("booking_id", booking.id);
    expect(lines).toHaveLength(1);
    expect(Number(lines![0].unit_price)).toBe(1500);
  });

  it("records a created event instead of appending to notes", async () => {
    const { data } = await adminClient()
      .from("booking_events")
      .select("type, to_status, note")
      .eq("booking_id", bookingIds[0]);

    expect(data!.some((e) => e.type === "created" && e.to_status === "pending")).toBe(true);

    const { data: booking } = await adminClient()
      .from("bookings")
      .select("notes")
      .eq("id", bookingIds[0])
      .single();
    // The legacy system appended "(System Approved)" and similar into notes.
    expect(booking!.notes).toBe("Integration test");
  });

  it("refuses a second booking for the same slot", async () => {
    const slot = await openSlot(customer.client, 42);

    const first = await customer.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
    });
    expect(first.error).toBeNull();
    bookingIds.push((first.data as unknown as { id: string }).id);

    const second = await other.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
    });
    expect(second.error?.code).toBe("23P01");
  });

  it("stops the booked slot being offered again", async () => {
    const booked = await adminClient()
      .from("bookings")
      .select("starts_at")
      .in("id", bookingIds)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();

    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(booked.data!.starts_at),
    );
    const { data: slots } = await customer.client.rpc("available_slots", {
      p_package_id: packageId,
      p_date: date,
    });

    expect(slots!.some((s) => s.starts_at === booked.data!.starts_at)).toBe(false);
  });

  it("cancels, frees the slot, and restores it on undo", async () => {
    const slot = await openSlot(customer.client, 54);
    const created = await customer.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
    });
    expect(created.error).toBeNull();
    const id = (created.data as unknown as { id: string }).id;
    bookingIds.push(id);

    const cancelled = await customer.client.rpc("cancel_booking", { p_booking_id: id });
    expect(cancelled.error).toBeNull();
    expect((cancelled.data as unknown as { status: string }).status).toBe("cancelled");

    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(slot.starts_at),
    );
    const freed = await customer.client.rpc("available_slots", {
      p_package_id: packageId,
      p_date: date,
    });
    expect(freed.data!.some((s) => s.starts_at === slot.starts_at)).toBe(true);

    const undone = await customer.client.rpc("undo_cancel_booking", { p_booking_id: id });
    expect(undone.error).toBeNull();
    expect((undone.data as unknown as { status: string }).status).toBe("pending");
  });

  it("refuses to restore a cancellation when the slot has been retaken", async () => {
    const slot = await openSlot(customer.client, 66);
    const mine = await customer.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
    });
    const id = (mine.data as unknown as { id: string }).id;
    bookingIds.push(id);

    await customer.client.rpc("cancel_booking", { p_booking_id: id });

    // Someone else takes the freed slot.
    const theirs = await other.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
    });
    expect(theirs.error).toBeNull();
    bookingIds.push((theirs.data as unknown as { id: string }).id);

    // Undo must not double-book. The legacy undo did not re-check.
    const undone = await customer.client.rpc("undo_cancel_booking", { p_booking_id: id });
    expect(undone.error?.code).toBe("23P01");
  });

  it("keeps a customer from cancelling another customer's booking", async () => {
    const { error } = await other.client.rpc("cancel_booking", { p_booking_id: bookingIds[0] });
    expect(error).not.toBeNull();
  });

  it("refuses a booking that is not on the availability list", async () => {
    const slot = await openSlot(customer.client, 78);
    // 20 minutes past the hour is never an offered start with a 60-minute grid.
    const offGrid = new Date(new Date(slot.starts_at).getTime() + 20 * 60000).toISOString();

    const { error } = await customer.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: offGrid,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not available/i);
  });
});
