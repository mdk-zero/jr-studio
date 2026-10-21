import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  hasCredentials,
  packageIdBySlug,
  url,
  publishableKey,
  type Client,
} from "./helpers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type User = { client: Client; userId: string; email: string };

/**
 * Phase 6 rules: what customers may change on their own record, staff login
 * guard rails, review requests by token, unsubscribe, the contact inbox and
 * the email log. Exercised as real signed-in users so RLS, grants, triggers
 * and the functions' own checks all apply as they do in the app.
 */
describe.skipIf(!hasCredentials)("people and content", () => {
  let customer: User;
  let staff: User;
  let admin: User;
  let customerId: string;
  let packageId: string;
  const bookingIds: string[] = [];
  const customerEmails: string[] = [];
  const userIds: string[] = [];

  /** A completed booking in the past for a customer, written as fixture data. */
  async function completedBooking(forCustomer: string, daysAgo: number): Promise<string> {
    const db = adminClient();
    const startsAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    // 9 PM Manila: after hours, so it cannot collide with seeded or other
    // tests' sessions on the studio-wide exclusion constraint.
    startsAt.setUTCHours(13, 0, 0, 0);
    const { data, error } = await db
      .from("bookings")
      .insert({
        customer_id: forCustomer,
        package_id: packageId,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
        status: "completed",
        package_price: 1000,
        total_amount: 1000,
        source: "admin",
      })
      .select("id")
      .single();
    if (error) throw error;
    bookingIds.push(data.id);
    return data.id;
  }

  beforeAll(async () => {
    [customer, staff, admin] = await Promise.all([
      createUser("customer", "p6-cust"),
      createUser("staff", "p6-staff"),
      createUser("admin", "p6-admin"),
    ]);
    userIds.push(customer.userId, staff.userId, admin.userId);
    packageId = await packageIdBySlug("pro-portraits");

    const { data } = await adminClient()
      .from("customers")
      .select("id")
      .eq("profile_id", customer.userId)
      .single();
    customerId = data!.id;
  });

  afterAll(async () => {
    const db = adminClient();
    if (bookingIds.length) {
      await db.from("testimonials").delete().in("booking_id", bookingIds);
      await db.from("bookings").delete().in("id", bookingIds);
    }
    await db.from("email_log").delete().like("campaign_key", "test-%");
    await db.from("contact_messages").delete().like("email", "test-contact-%");
    const emails = [customer.email, staff.email, admin.email, ...customerEmails];
    await db.from("customers").delete().in("email", emails);
    await Promise.all(userIds.map((id) => deleteUser(id)));
  });

  // -------------------------------------------------------------------------
  // Customers
  // -------------------------------------------------------------------------
  describe("a customer's own record", () => {
    it("can change contact details and marketing consent, which is timestamped", async () => {
      const { error } = await customer.client
        .from("customers")
        .update({ phone: "09170000001", marketing_opt_in: true })
        .eq("id", customerId);
      expect(error).toBeNull();

      const { data } = await adminClient()
        .from("customers")
        .select("phone, marketing_opt_in, marketing_opt_in_at")
        .eq("id", customerId)
        .single();
      expect(data).toMatchObject({ phone: "09170000001", marketing_opt_in: true });
      expect(data!.marketing_opt_in_at).not.toBeNull();
    });

    it("cannot forge the consent timestamp", async () => {
      await customer.client
        .from("customers")
        .update({ marketing_opt_in_at: "2001-01-01T00:00:00Z" })
        .eq("id", customerId);
      const { data } = await adminClient()
        .from("customers")
        .select("marketing_opt_in_at")
        .eq("id", customerId)
        .single();
      expect(data!.marketing_opt_in_at?.startsWith("2001")).toBe(false);
    });

    it.each([
      ["tier", { tier: "vip" as const }],
      ["status", { status: "inactive" as const }],
      ["email", { email: "someone-else@example.com" }],
    ])("cannot change their own %s", async (_label, change) => {
      const { error } = await customer.client.from("customers").update(change).eq("id", customerId);
      expect(error?.code).toBe("42501");
    });

    it("staff can change tier and status", async () => {
      const { error } = await staff.client
        .from("customers")
        .update({ tier: "vip" })
        .eq("id", customerId);
      expect(error).toBeNull();
      await adminClient().from("customers").update({ tier: "regular" }).eq("id", customerId);
    });

    it("signup consent carries into the new customer record", async () => {
      const db = adminClient();
      const email = `test-optin-${Date.now()}@example.com`;
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: `Test-${Math.random().toString(36).slice(2)}-9aZ!`,
        email_confirm: true,
        user_metadata: { full_name: "Opt In", marketing_opt_in: true },
      });
      if (error) throw error;
      userIds.push(data.user.id);
      customerEmails.push(email);

      const { data: row } = await db
        .from("customers")
        .select("marketing_opt_in, marketing_opt_in_at")
        .eq("profile_id", data.user.id)
        .single();
      expect(row!.marketing_opt_in).toBe(true);
      expect(row!.marketing_opt_in_at).not.toBeNull();
    });

    it("customer_summary shows staff everyone and a customer only themself", async () => {
      const asStaff = await staff.client.from("customer_summary").select("customer_id").limit(50);
      expect((asStaff.data ?? []).length).toBeGreaterThan(1);

      const asCustomer = await customer.client.from("customer_summary").select("customer_id");
      expect(asCustomer.data).toEqual([{ customer_id: customerId }]);

      const asAnon = await anonClient().from("customer_summary").select("customer_id");
      expect(asAnon.error).not.toBeNull();
    });

    it("a note is always authored by whoever is signed in", async () => {
      const forged = await staff.client
        .from("customer_notes")
        .insert({ customer_id: customerId, body: "Forged", author_id: admin.userId });
      expect(forged.error?.code).toBe("42501");

      const { data, error } = await staff.client
        .from("customer_notes")
        .insert({ customer_id: customerId, body: "Prefers mornings." })
        .select("author_id")
        .single();
      expect(error).toBeNull();
      expect(data!.author_id).toBe(staff.userId);

      const asCustomer = await customer.client
        .from("customer_notes")
        .insert({ customer_id: customerId, body: "Hi" });
      expect(asCustomer.error).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Studio logins
  // -------------------------------------------------------------------------
  describe("roles", () => {
    it("an admin cannot change their own role", async () => {
      const { error } = await admin.client
        .from("profiles")
        .update({ role: "staff" })
        .eq("id", admin.userId);
      expect(error?.message).toMatch(/your own role/);
    });

    it("staff cannot promote themselves or anyone else", async () => {
      const self = await staff.client.from("profiles").update({ role: "admin" }).eq("id", staff.userId);
      expect(self.error?.code).toBe("42501");

      // Someone else's profile is outside staff's UPDATE policy, so nothing matches.
      await staff.client.from("profiles").update({ role: "admin" }).eq("id", customer.userId);
      const { data } = await adminClient().from("profiles").select("role").eq("id", customer.userId).single();
      expect(data!.role).toBe("customer");
    });

    it("an admin can promote and demote someone else", async () => {
      const up = await admin.client.from("profiles").update({ role: "staff" }).eq("id", customer.userId);
      expect(up.error).toBeNull();
      const down = await admin.client.from("profiles").update({ role: "customer" }).eq("id", customer.userId);
      expect(down.error).toBeNull();
    });

    it("an invited staff login does not become a customer when it is accepted", async () => {
      const db = adminClient();
      const email = `test-invite-${Date.now()}@example.com`;
      const { data: link, error } = await db.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: { full_name: "Invited Staff" } },
      });
      if (error) throw error;
      userIds.push(link.user.id);
      await db.from("profiles").update({ role: "staff" }).eq("id", link.user.id);

      // Accepting the invite confirms the email, which is when customers are linked.
      const visitor = createClient<Database>(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: verifyError } = await visitor.auth.verifyOtp({
        type: "invite",
        token_hash: link.properties.hashed_token,
      });
      expect(verifyError).toBeNull();

      const { data: rows } = await db.from("customers").select("id").eq("profile_id", link.user.id);
      expect(rows).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------
  describe("review requests", () => {
    let bookingId: string;
    let token: string;

    beforeAll(async () => {
      bookingId = await completedBooking(customerId, 3);
    });

    it("only staff can request one, and only for a completed session", async () => {
      const asCustomer = await customer.client.rpc("request_feedback", { p_booking_id: bookingId });
      expect(asCustomer.error?.code).toBe("42501");

      const { data, error } = await staff.client.rpc("request_feedback", { p_booking_id: bookingId });
      expect(error).toBeNull();
      expect(data).toMatch(/^[0-9a-f]{48}$/);
      token = data!;
    });

    it("asking again reuses the open link", async () => {
      const { data } = await staff.client.rpc("request_feedback", { p_booking_id: bookingId });
      expect(data).toBe(token);
    });

    it("a visitor with the token sees who and what it is for, and nothing more", async () => {
      const { data } = await anonClient().rpc("get_feedback_request", { p_token: token });
      expect(data?.[0]).toMatchObject({ state: "open", first_name: "Test" });

      const bogus = await anonClient().rpc("get_feedback_request", { p_token: "0".repeat(48) });
      expect(bogus.data).toEqual([]);
    });

    it("a visitor can submit with the token; it arrives unpublished and closes the link", async () => {
      const bad = await anonClient().rpc("submit_feedback", {
        p_token: token,
        p_rating: 9,
        p_message: "Great",
        p_author_name: "T.",
      });
      expect(bad.error?.code).toBe("22023");

      const { data: id, error } = await anonClient().rpc("submit_feedback", {
        p_token: token,
        p_rating: 5,
        p_message: "Lovely session, very patient with our toddler.",
        p_author_name: "Test C.",
      });
      expect(error).toBeNull();

      const { data: review } = await adminClient()
        .from("testimonials")
        .select("status, is_featured, customer_id, rating")
        .eq("id", id!)
        .single();
      expect(review).toMatchObject({ status: "pending", is_featured: false, customer_id: customerId, rating: 5 });

      const again = await anonClient().rpc("submit_feedback", {
        p_token: token,
        p_rating: 1,
        p_message: "Second try",
        p_author_name: "Test C.",
      });
      expect(again.error?.code).toBe("23505");

      const { data: state } = await anonClient().rpc("get_feedback_request", { p_token: token });
      expect(state?.[0].state).toBe("done");
    });

    it("a reviewed session cannot be asked again", async () => {
      const { error } = await staff.client.rpc("request_feedback", { p_booking_id: bookingId });
      expect(error?.code).toBe("23505");
    });

    it("moderation stamps the reviewer, and only published reviews can be featured", async () => {
      const { data: review } = await adminClient()
        .from("testimonials")
        .select("id")
        .eq("booking_id", bookingId)
        .single();

      const featureFirst = await staff.client
        .from("testimonials")
        .update({ is_featured: true })
        .eq("id", review!.id)
        .select("is_featured")
        .single();
      expect(featureFirst.data?.is_featured).toBe(false);

      const { error } = await staff.client
        .from("testimonials")
        .update({ status: "approved" })
        .eq("id", review!.id);
      expect(error).toBeNull();

      const { data } = await adminClient()
        .from("testimonials")
        .select("reviewed_by, reviewed_at")
        .eq("id", review!.id)
        .single();
      expect(data!.reviewed_by).toBe(staff.userId);
      expect(data!.reviewed_at).not.toBeNull();

      const reassign = await staff.client
        .from("testimonials")
        .update({ customer_id: customerId })
        .eq("id", review!.id);
      expect(reassign.error?.code).toBe("42501");
    });

    it("a signed-in customer's own review closes an open request too", async () => {
      const second = await completedBooking(customerId, 5);
      const { data: link } = await staff.client.rpc("request_feedback", { p_booking_id: second });

      const { error } = await customer.client.from("testimonials").insert({
        customer_id: customerId,
        booking_id: second,
        package_id: packageId,
        rating: 4,
        message: "Nice.",
        author_name: "Test C.",
      });
      expect(error).toBeNull();

      const { data } = await anonClient().rpc("get_feedback_request", { p_token: link! });
      expect(data?.[0].state).toBe("done");
    });
  });

  // -------------------------------------------------------------------------
  // Unsubscribe, inbox, email log
  // -------------------------------------------------------------------------
  it("anyone holding the token can unsubscribe, and nothing else changes", async () => {
    const db = adminClient();
    await db.from("customers").update({ marketing_opt_in: true }).eq("id", customerId);
    const { data: row } = await db
      .from("customers")
      .select("unsubscribe_token, tier")
      .eq("id", customerId)
      .single();

    const { data, error } = await anonClient().rpc("unsubscribe_marketing", { p_token: row!.unsubscribe_token });
    expect(error).toBeNull();
    expect(data).toBe(true);

    const { data: after } = await db
      .from("customers")
      .select("marketing_opt_in, marketing_opt_in_at, tier")
      .eq("id", customerId)
      .single();
    expect(after).toMatchObject({ marketing_opt_in: false, marketing_opt_in_at: null, tier: row!.tier });

    const junk = await anonClient().rpc("unsubscribe_marketing", { p_token: "' or 1=1 --" });
    expect(junk.data).toBe(false);
  });

  it("visitors can no longer write to the inbox directly; staff can only mark read", async () => {
    const direct = await anonClient()
      .from("contact_messages")
      .insert({ name: "Bot", email: "test-contact-bot@example.com", message: "Spam spam spam" });
    expect(direct.error).not.toBeNull();

    const { data: msg } = await adminClient()
      .from("contact_messages")
      .insert({ name: "Visitor", email: "test-contact-visitor@example.com", message: "Do you shoot debuts?" })
      .select("id")
      .single();

    const read = await staff.client.from("contact_messages").update({ is_read: true }).eq("id", msg!.id);
    expect(read.error).toBeNull();

    const rewrite = await staff.client
      .from("contact_messages")
      .update({ message: "Edited" })
      .eq("id", msg!.id);
    expect(rewrite.error?.code).toBe("42501");
  });

  it("a campaign logs each recipient once, however often it is submitted", async () => {
    const db = adminClient();
    const row = {
      to_email: "test-campaign@example.com",
      subject: "Hello",
      template: "campaign",
      status: "queued",
      campaign_key: "test-campaign-1",
    };
    const first = await db
      .from("email_log")
      .upsert([row], { onConflict: "campaign_key,to_email", ignoreDuplicates: true })
      .select("id");
    const second = await db
      .from("email_log")
      .upsert([row], { onConflict: "campaign_key,to_email", ignoreDuplicates: true })
      .select("id");
    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(0);

    const asStaff = await staff.client.from("email_log").insert({ ...row, campaign_key: "test-campaign-2" });
    expect(asStaff.error).not.toBeNull();
  });
});
