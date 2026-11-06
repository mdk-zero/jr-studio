import { expect, test } from "@playwright/test";
import { addDaysToDateString } from "@/lib/datetime";
import { adminDb, bookableDate, createAccount, deleteAccount } from "./helpers";
import { firstOpenSlot, signedInClient, signedOutClient } from "./qa-helpers";

/**
 * QA-authored. The rules the database enforces, whatever the browser does.
 * These talk to the same database API the website uses, with the same rights
 * as a real visitor or customer (no secret key), so a crafted request is tried
 * the way an attacker would try it:
 *   TC-RULE-01  the same time cannot be booked twice
 *   TC-RULE-02  a time the studio does not offer is refused
 *   TC-RULE-03  a customer cannot write a booking straight into the table
 *   TC-RULE-04  a signed-out visitor sees no bookings and cannot book
 */

test("TC-RULE-01: the same time cannot be booked twice", async () => {
  const first = await createAccount("customer", "rule-a");
  const second = await createAccount("customer", "rule-b");
  try {
    const a = await signedInClient(first);
    const b = await signedInClient(second);
    const slot = await firstOpenSlot(a, "pro-portraits", bookableDate(28));

    const ok = await a.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: slot.startsAt, p_addon_ids: [] });
    expect(ok.error).toBeNull();

    const clash = await b.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: slot.startsAt, p_addon_ids: [] });
    expect(clash.error?.message).toMatch(/not available/i);

    const { data } = await adminDb().from("bookings").select("id").eq("starts_at", slot.startsAt).neq("status", "cancelled");
    expect(data).toHaveLength(1);
  } finally {
    await deleteAccount(first.id);
    await deleteAccount(second.id);
  }
});

test("TC-RULE-02: a time the studio does not offer is refused", async () => {
  const customer = await createAccount("customer", "rule-offgrid");
  try {
    const client = await signedInClient(customer);
    const slot = await firstOpenSlot(client, "pro-portraits", bookableDate(29));

    // Seven minutes off the offered time: not on the grid.
    const offGrid = new Date(new Date(slot.startsAt).getTime() + 7 * 60_000).toISOString();
    const odd = await client.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: offGrid, p_addon_ids: [] });
    expect(odd.error?.message).toMatch(/not available/i);

    // Three in the morning, long before opening time.
    const night = `${bookableDate(29)}T03:00:00+08:00`;
    const early = await client.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: night, p_addon_ids: [] });
    expect(early.error?.message).toMatch(/not available/i);

    // A date in the past.
    const past = `${addDaysToDateString(bookableDate(0), -10)}T10:00:00+08:00`;
    const back = await client.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: past, p_addon_ids: [] });
    expect(back.error?.message).toMatch(/not available/i);

    const { data } = await adminDb().from("customers").select("id").eq("profile_id", customer.id).single();
    const { data: made } = await adminDb().from("bookings").select("id").eq("customer_id", data!.id);
    expect(made).toHaveLength(0);
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-RULE-03: a customer cannot write a booking straight into the table", async () => {
  const customer = await createAccount("customer", "rule-forge");
  try {
    const client = await signedInClient(customer);
    const slot = await firstOpenSlot(client, "pro-portraits", bookableDate(30));
    const { data: me } = await adminDb().from("customers").select("id").eq("profile_id", customer.id).single();

    // A forged booking priced at zero, written directly instead of through
    // create_booking (which always works out the price itself).
    const forged = await client.from("bookings").insert({
      customer_id: me!.id,
      package_id: slot.packageId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      status: "approved",
      source: "customer",
      package_price: 0,
      addons_total: 0,
      discount_amount: 0,
      total_amount: 0,
    });
    // Refused for lack of permission, not for a missing column or a constraint.
    expect(forged.error?.code, "the direct insert is refused").toBe("42501");

    const { data: made } = await adminDb().from("bookings").select("id").eq("customer_id", me!.id);
    expect(made).toHaveLength(0);
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-RULE-04: a signed-out visitor sees no bookings and cannot book", async () => {
  const owner = await createAccount("customer", "rule-anon");
  try {
    // Something exists to be seen.
    const client = await signedInClient(owner);
    const slot = await firstOpenSlot(client, "pro-portraits", bookableDate(31));
    const made = await client.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: slot.startsAt, p_addon_ids: [] });
    expect(made.error).toBeNull();

    const visitor = signedOutClient();
    for (const table of ["bookings", "customers", "payments", "contact_messages"] as const) {
      const { data } = await visitor.from(table).select("*");
      expect(data ?? [], `${table} visible to a visitor`).toEqual([]);
    }

    const attempt = await visitor.rpc("create_booking", { p_package_id: slot.packageId, p_starts_at: slot.startsAt, p_addon_ids: [] });
    expect(attempt.error, "a visitor cannot book").not.toBeNull();

    // The public catalogue is still readable: the website needs it.
    const { data: packages } = await visitor.from("packages").select("slug").eq("is_active", true);
    expect((packages ?? []).length).toBeGreaterThan(0);
  } finally {
    await deleteAccount(owner.id);
  }
});
