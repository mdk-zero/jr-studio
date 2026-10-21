import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDaysToDateString, manilaToday, manilaToUtc, toManilaDateString } from "@/lib/datetime";
import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  hasCredentials,
  packageIdBySlug,
  type Client,
} from "./helpers";

type User = { client: Client; userId: string; email: string };

/**
 * Staff-side booking operations and the payment ledger, exercised as real
 * signed-in staff, admin and customer users so RLS, grants and the functions'
 * own checks all apply exactly as they do in the app.
 */
describe.skipIf(!hasCredentials)("admin bookings and payments", () => {
  let customer: User;
  let staff: User;
  let admin: User;
  let customerId: string;
  let packageId: string;
  let activeStaffId: string;
  let inactiveStaffId: string;
  const bookingIds: string[] = [];
  const customerEmails: string[] = [];

  beforeAll(async () => {
    [customer, staff, admin] = await Promise.all([
      createUser("customer", "adm-cust"),
      createUser("staff", "adm-staff"),
      createUser("admin", "adm-admin"),
    ]);
    packageId = await packageIdBySlug("pro-portraits");

    const db = adminClient();
    const { data: me } = await db
      .from("customers").select("id").eq("profile_id", customer.userId).single();
    customerId = me!.id;

    const { data: people } = await db.from("staff_members").select("id, status");
    activeStaffId = people!.find((s) => s.status === "active")!.id;
    inactiveStaffId = people!.find((s) => s.status === "inactive")!.id;
  });

  afterAll(async () => {
    const db = adminClient();
    if (bookingIds.length) {
      // Payments restrict booking deletes now, so the ledger goes first.
      await db.from("payments").delete().in("booking_id", bookingIds);
      await db.from("bookings").delete().in("id", bookingIds);
    }
    if (customerEmails.length) await db.from("customers").delete().in("email", customerEmails);
    await db.from("customers").delete().in("email", [customer.email, staff.email, admin.email]);
    await Promise.all([customer, staff, admin].map((u) => deleteUser(u.userId)));
  });

  /** The first studio slot at least `fromDays` out, for a 30-minute session. */
  async function staffSlot(fromDays: number, minutes = 30) {
    for (let d = fromDays; d < fromDays + 10; d++) {
      const date = addDaysToDateString(manilaToday(), d);
      const { data, error } = await staff.client.rpc("staff_available_slots", {
        p_date: date,
        p_duration_minutes: minutes,
      });
      if (error) throw error;
      if (data && data.length) return data[0];
    }
    throw new Error("no studio slot found");
  }

  async function staffBooking(fromDays: number, extra: Record<string, unknown> = {}) {
    const slot = await staffSlot(fromDays);
    const { data, error } = await staff.client.rpc("create_staff_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
      p_customer_id: customerId,
      ...extra,
    });
    if (error) throw error;
    bookingIds.push(data!.id);
    return data!;
  }

  /** A booking whose session already happened, inserted past the API rules. */
  async function pastBooking(status: "approved" | "pending", daysAgo: number) {
    const date = addDaysToDateString(manilaToday(), -daysAgo);
    const startsAt = manilaToUtc(date, "10:00");
    const { data, error } = await adminClient()
      .from("bookings")
      .insert({
        customer_id: customerId,
        package_id: packageId,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
        status,
        package_price: 600,
        total_amount: 600,
        source: "admin",
      })
      .select("id")
      .single();
    if (error) throw error;
    bookingIds.push(data.id);
    return data.id;
  }

  async function events(bookingId: string) {
    const { data } = await adminClient()
      .from("booking_events")
      .select("type, from_status, to_status, note")
      .eq("booking_id", bookingId)
      .order("created_at");
    return data ?? [];
  }

  async function summary(bookingId: string) {
    const { data } = await staff.client
      .from("booking_payment_summary")
      .select("paid_total, balance, payment_status")
      .eq("booking_id", bookingId)
      .single();
    return { paid: Number(data!.paid_total), balance: Number(data!.balance), status: data!.payment_status };
  }

  // -------------------------------------------------------------------------
  // Studio availability
  // -------------------------------------------------------------------------
  it("keeps the studio calendar from customers and visitors", async () => {
    const args = { p_date: addDaysToDateString(manilaToday(), 5), p_duration_minutes: 30 };

    const asCustomer = await customer.client.rpc("staff_available_slots", args);
    expect(asCustomer.error?.code).toBe("42501");

    const asAnon = await anonClient().rpc("staff_available_slots", args);
    expect(asAnon.error).not.toBeNull();
  });

  it("offers staff the slots customers cannot book: inside the lead time and past the advance window", async () => {
    // Beyond max_advance_days, customers get nothing and staff still get a grid.
    const far = await staffSlot(120);
    const farDate = toManilaDateString(new Date(far.starts_at));
    const { data: customerFar } = await customer.client.rpc("available_slots", {
      p_package_id: packageId,
      p_date: farDate,
    });
    expect(customerFar).toEqual([]);

    // Inside the 24-hour lead time: some day in the next few has a slot only staff see.
    let staffOnly = false;
    for (let d = 0; d < 4 && !staffOnly; d++) {
      const date = addDaysToDateString(manilaToday(), d);
      const [{ data: s }, { data: c }] = await Promise.all([
        staff.client.rpc("staff_available_slots", { p_date: date, p_duration_minutes: 30 }),
        customer.client.rpc("available_slots", { p_package_id: packageId, p_date: date }),
      ]);
      const customerStarts = new Set((c ?? []).map((x) => x.starts_at));
      staffOnly = (s ?? []).some((x) => !customerStarts.has(x.starts_at));
    }
    expect(staffOnly).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Studio-made bookings
  // -------------------------------------------------------------------------
  it("books an existing customer, auto-approved and priced by the server", async () => {
    const booking = await staffBooking(100, { p_notes: "Phone booking" });

    const { data: quote } = await staff.client.rpc("quote_booking", {
      p_package_id: packageId,
      p_addon_ids: [],
    });
    expect(booking.status).toBe("approved");
    expect(booking.source).toBe("admin");
    expect(Number(booking.total_amount)).toBe(Number(quote![0].total_amount));

    const history = await events(booking.id);
    expect(history[0]).toMatchObject({ type: "created", to_status: "approved", note: "Booked by the studio" });
  });

  it("creates a walk-in customer and the booking together", async () => {
    const email = `walkin-${Date.now()}@example.com`;
    customerEmails.push(email);

    const slot = await staffSlot(101);
    const { data, error } = await staff.client.rpc("create_staff_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
      p_customer_name: "Walk-in Test",
      p_customer_email: email.toUpperCase(),
      p_customer_phone: "09171112222",
    });
    expect(error).toBeNull();
    bookingIds.push(data!.id);

    const { data: created } = await adminClient()
      .from("customers").select("id, full_name, email, profile_id").eq("id", data!.customer_id).single();
    expect(created).toMatchObject({ full_name: "Walk-in Test", email, profile_id: null });
  });

  it("refuses a walk-in whose email belongs to an existing customer, and leaves nothing behind", async () => {
    const slot = await staffSlot(102);
    const { error } = await staff.client.rpc("create_staff_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
      p_customer_name: "Duplicate",
      p_customer_email: customer.email,
    });
    expect(error?.code).toBe("23505");

    // The slot is still free: the failed call rolled back as one transaction.
    const { data: again } = await staff.client.rpc("staff_available_slots", {
      p_date: toManilaDateString(new Date(slot.starts_at)),
      p_duration_minutes: 30,
    });
    expect(again!.some((s) => s.starts_at === slot.starts_at)).toBe(true);
  });

  it("refuses a studio booking off the slot grid or outside business hours", async () => {
    const slot = await staffSlot(103);
    const offGrid = new Date(new Date(slot.starts_at).getTime() + 20 * 60_000).toISOString();
    const late = manilaToUtc(toManilaDateString(new Date(slot.starts_at)), "22:00").toISOString();

    for (const startsAt of [offGrid, late]) {
      const { error } = await staff.client.rpc("create_staff_booking", {
        p_package_id: packageId,
        p_starts_at: startsAt,
        p_customer_id: customerId,
      });
      expect(error?.code).toBe("23P01");
    }
  });

  it("refuses an inactive staff member and lets only staff create studio bookings", async () => {
    const slot = await staffSlot(104);
    const inactive = await staff.client.rpc("create_staff_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
      p_customer_id: customerId,
      p_staff_id: inactiveStaffId,
    });
    expect(inactive.error?.message).toMatch(/not active/i);

    const asCustomer = await customer.client.rpc("create_staff_booking", {
      p_package_id: packageId,
      p_starts_at: slot.starts_at,
      p_customer_id: customerId,
    });
    expect(asCustomer.error?.code).toBe("42501");
  });

  it("gives staff no direct write path into bookings, their history or the ledger", async () => {
    const booking = await staffBooking(105);

    const insert = await staff.client.from("bookings").insert({
      customer_id: customerId,
      package_id: packageId,
      starts_at: new Date(Date.now() + 200 * 86400_000).toISOString(),
      ends_at: new Date(Date.now() + 200 * 86400_000 + 1800_000).toISOString(),
      package_price: 0,
      total_amount: 0,
      source: "admin",
    });
    expect(insert.error).not.toBeNull();

    const update = await staff.client.from("bookings").update({ total_amount: 1 }).eq("id", booking.id);
    expect(update.error).not.toBeNull();

    const event = await staff.client.from("booking_events").insert({ booking_id: booking.id, type: "forged" });
    expect(event.error).not.toBeNull();

    const payment = await staff.client.from("payments").insert({ booking_id: booking.id, amount: 100 });
    expect(payment.error).not.toBeNull();

    const { data: untouched } = await adminClient()
      .from("bookings").select("total_amount").eq("id", booking.id).single();
    expect(Number(untouched!.total_amount)).toBe(Number(booking.total_amount));
  });

  // -------------------------------------------------------------------------
  // Status rules
  // -------------------------------------------------------------------------
  it("approves a pending booking and records where it came from", async () => {
    const slot = await customer.client
      .rpc("available_slots", { p_package_id: packageId, p_date: addDaysToDateString(manilaToday(), 84) })
      .then(({ data }) => data?.[0]);
    let start = slot;
    for (let d = 85; !start && d < 90; d++) {
      const { data } = await customer.client.rpc("available_slots", {
        p_package_id: packageId,
        p_date: addDaysToDateString(manilaToday(), d),
      });
      start = data?.[0];
    }
    const { data: pending, error } = await customer.client.rpc("create_booking", {
      p_package_id: packageId,
      p_starts_at: start!.starts_at,
    });
    expect(error).toBeNull();
    bookingIds.push(pending!.id);

    const approved = await staff.client.rpc("set_booking_status", {
      p_booking_id: pending!.id,
      p_status: "approved",
    });
    expect(approved.error).toBeNull();
    expect(approved.data!.status).toBe("approved");

    // A second click is harmless rather than an error.
    const repeat = await staff.client.rpc("set_booking_status", {
      p_booking_id: pending!.id,
      p_status: "approved",
    });
    expect(repeat.error).toBeNull();

    const history = await events(pending!.id);
    expect(history.filter((e) => e.type === "status_changed")).toEqual([
      { type: "status_changed", from_status: "pending", to_status: "approved", note: "Approved by the studio" },
    ]);

    // Approved can be cancelled, never rejected, and not completed before it happens.
    const reject = await staff.client.rpc("set_booking_status", {
      p_booking_id: pending!.id,
      p_status: "rejected",
    });
    expect(reject.error?.message).toMatch(/cannot be rejected/i);

    const complete = await staff.client.rpc("set_booking_status", {
      p_booking_id: pending!.id,
      p_status: "completed",
    });
    expect(complete.error?.message).toMatch(/not happened yet/i);
  });

  it("cancels on the studio's behalf without opening the customer's undo window", async () => {
    const booking = await staffBooking(106);

    const cancelled = await staff.client.rpc("set_booking_status", {
      p_booking_id: booking.id,
      p_status: "cancelled",
      p_note: "Studio closed for repairs",
    });
    expect(cancelled.error).toBeNull();
    expect(cancelled.data!.cancelled_at).toBeNull();

    const undo = await customer.client.rpc("undo_cancel_booking", { p_booking_id: booking.id });
    expect(undo.error).not.toBeNull();

    const history = await events(booking.id);
    expect(history.at(-1)).toMatchObject({
      from_status: "approved",
      to_status: "cancelled",
      note: "Cancelled by the studio: Studio closed for repairs",
    });

    // Final: nothing brings it back by hand.
    const revive = await staff.client.rpc("set_booking_status", {
      p_booking_id: booking.id,
      p_status: "approved",
    });
    expect(revive.error).not.toBeNull();
  });

  it("completes a session that has happened, and will not approve one that has started", async () => {
    const happened = await pastBooking("approved", 400);
    const completed = await staff.client.rpc("set_booking_status", {
      p_booking_id: happened,
      p_status: "completed",
    });
    expect(completed.error).toBeNull();
    expect(completed.data!.status).toBe("completed");

    const stale = await pastBooking("pending", 401);
    const approve = await staff.client.rpc("set_booking_status", {
      p_booking_id: stale,
      p_status: "approved",
    });
    expect(approve.error?.message).toMatch(/already started/i);

    // pending and expired are never set by hand (expiry is the cron job's).
    for (const status of ["pending", "expired"] as const) {
      const { error } = await staff.client.rpc("set_booking_status", {
        p_booking_id: happened,
        p_status: status,
      });
      expect(error?.message).toMatch(/by hand/i);
    }
  });

  it("lets only staff change a status", async () => {
    const booking = await staffBooking(107);
    const { error } = await customer.client.rpc("set_booking_status", {
      p_booking_id: booking.id,
      p_status: "cancelled",
    });
    expect(error?.code).toBe("42501");
  });

  // -------------------------------------------------------------------------
  // Reschedule and staff assignment
  // -------------------------------------------------------------------------
  it("reschedules onto a free slot, keeps the length, and frees the old time", async () => {
    const booking = await staffBooking(108);
    const target = await staffSlot(110);

    const moved = await staff.client.rpc("reschedule_booking", {
      p_booking_id: booking.id,
      p_starts_at: target.starts_at,
    });
    expect(moved.error).toBeNull();
    expect(moved.data!.starts_at).toBe(target.starts_at);
    const minutes = (new Date(moved.data!.ends_at).getTime() - new Date(target.starts_at).getTime()) / 60_000;
    expect(minutes).toBe(30);

    const { data: freed } = await staff.client.rpc("staff_available_slots", {
      p_date: toManilaDateString(new Date(booking.starts_at)),
      p_duration_minutes: 30,
    });
    expect(freed!.some((s) => s.starts_at === booking.starts_at)).toBe(true);

    expect((await events(booking.id)).at(-1)).toMatchObject({ type: "rescheduled" });
    expect((await events(booking.id)).at(-1)!.note).toMatch(/^Moved from .+ to .+/);
  });

  it("will not reschedule onto another booking or move a finished one", async () => {
    const first = await staffBooking(111);
    const second = await staffBooking(111);

    const clash = await staff.client.rpc("reschedule_booking", {
      p_booking_id: second.id,
      p_starts_at: first.starts_at,
    });
    expect(clash.error?.code).toBe("23P01");

    await staff.client.rpc("set_booking_status", { p_booking_id: second.id, p_status: "cancelled" });
    const target = await staffSlot(112);
    const cancelled = await staff.client.rpc("reschedule_booking", {
      p_booking_id: second.id,
      p_starts_at: target.starts_at,
    });
    expect(cancelled.error?.message).toMatch(/pending or approved/i);
  });

  it("assigns and unassigns staff, refusing anyone inactive", async () => {
    const booking = await staffBooking(113);

    const assigned = await staff.client.rpc("assign_booking_staff", {
      p_booking_id: booking.id,
      p_staff_id: activeStaffId,
    });
    expect(assigned.error).toBeNull();
    expect(assigned.data!.staff_id).toBe(activeStaffId);
    expect((await events(booking.id)).at(-1)!.note).toMatch(/^Assigned to /);

    const inactive = await staff.client.rpc("assign_booking_staff", {
      p_booking_id: booking.id,
      p_staff_id: inactiveStaffId,
    });
    expect(inactive.error?.message).toMatch(/not active/i);

    const cleared = await staff.client.rpc("assign_booking_staff", { p_booking_id: booking.id });
    expect(cleared.error).toBeNull();
    expect(cleared.data!.staff_id).toBeNull();
    expect((await events(booking.id)).at(-1)!.note).toMatch(/^Unassigned /);
  });

  // -------------------------------------------------------------------------
  // Payment ledger
  // -------------------------------------------------------------------------
  it("derives payment status from the ledger and refuses overpayment", async () => {
    const booking = await staffBooking(114);
    const total = Number(booking.total_amount);

    const deposit = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: 100,
      p_method: "gcash",
      p_reference_no: "GC-TEST-1",
    });
    expect(deposit.error).toBeNull();
    expect(await summary(booking.id)).toEqual({ paid: 100, balance: total - 100, status: "partial" });
    expect((await events(booking.id)).at(-1)!.note).toBe("Payment of ₱100.00 received (GCash)");

    const over = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: total,
      p_method: "cash",
    });
    expect(over.error?.message).toMatch(/more than the ₱[\d,.]+ still owed/);

    const rest = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: total - 100,
      p_method: "cash",
    });
    expect(rest.error).toBeNull();
    expect(await summary(booking.id)).toEqual({ paid: total, balance: 0, status: "paid" });
  });

  it("refunds no more than was paid, and only refunds once a booking is cancelled", async () => {
    const booking = await staffBooking(115);
    await staff.client.rpc("record_payment", { p_booking_id: booking.id, p_amount: 200, p_method: "cash" });
    await staff.client.rpc("set_booking_status", { p_booking_id: booking.id, p_status: "cancelled" });

    const payment = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: 50,
      p_method: "cash",
    });
    expect(payment.error?.message).toMatch(/record a refund instead/i);

    const tooMuch = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: -250,
      p_method: "cash",
    });
    expect(tooMuch.error?.message).toMatch(/cannot be more than the ₱200\.00 paid/);

    const refund = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: -200,
      p_method: "cash",
    });
    expect(refund.error).toBeNull();
    expect((await summary(booking.id)).status).toBe("refunded");
  });

  it("voids instead of deleting: admin only, with a reason, and never orphaning a refund", async () => {
    const booking = await staffBooking(116);
    const { data: deposit } = await staff.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: 300,
      p_method: "bank_transfer",
    });
    await staff.client.rpc("record_payment", { p_booking_id: booking.id, p_amount: -100, p_method: "bank_transfer" });

    const asStaff = await staff.client.rpc("void_payment", { p_payment_id: deposit!.id, p_reason: "typo" });
    expect(asStaff.error?.code).toBe("42501");

    const noReason = await admin.client.rpc("void_payment", { p_payment_id: deposit!.id, p_reason: "  " });
    expect(noReason.error?.message).toMatch(/reason/i);

    const orphan = await admin.client.rpc("void_payment", { p_payment_id: deposit!.id, p_reason: "Wrong booking" });
    expect(orphan.error?.message).toMatch(/void the refund first/i);

    const { data: refunds } = await adminClient()
      .from("payments").select("id").eq("booking_id", booking.id).lt("amount", 0);
    const voidRefund = await admin.client.rpc("void_payment", { p_payment_id: refunds![0].id, p_reason: "Entered twice" });
    expect(voidRefund.error).toBeNull();

    const voided = await admin.client.rpc("void_payment", { p_payment_id: deposit!.id, p_reason: "Wrong booking" });
    expect(voided.error).toBeNull();
    expect(voided.data!.voided_at).not.toBeNull();
    expect(await summary(booking.id)).toMatchObject({ paid: 0, status: "unpaid" });

    // Still on record, just no longer counted.
    const { data: rows } = await staff.client.from("payments").select("id").eq("booking_id", booking.id);
    expect(rows).toHaveLength(2);

    const twice = await admin.client.rpc("void_payment", { p_payment_id: deposit!.id, p_reason: "again" });
    expect(twice.error?.message).toMatch(/already been voided/i);
  });

  it("keeps the ledger closed to customers", async () => {
    const booking = await staffBooking(117);
    const { error } = await customer.client.rpc("record_payment", {
      p_booking_id: booking.id,
      p_amount: 10,
      p_method: "cash",
    });
    expect(error?.code).toBe("42501");
  });

  it("will not delete a booking that has money on record", async () => {
    const paid = await staffBooking(118);
    await staff.client.rpc("record_payment", { p_booking_id: paid.id, p_amount: 50, p_method: "cash" });

    const blocked = await admin.client.from("bookings").delete().eq("id", paid.id);
    expect(blocked.error?.code).toBe("23503");

    // Without payments an admin can remove a mistake; staff cannot.
    const mistake = await staffBooking(119);
    const asStaff = await staff.client.from("bookings").delete().eq("id", mistake.id).select("id");
    expect(asStaff.data ?? []).toEqual([]);

    const asAdmin = await admin.client.from("bookings").delete().eq("id", mistake.id).select("id");
    expect(asAdmin.error).toBeNull();
    expect(asAdmin.data).toHaveLength(1);
  });
});
