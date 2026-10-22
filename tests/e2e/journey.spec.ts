import { expect, test } from "@playwright/test";
import { adminDb, bookableDate, createAccount, deleteAccount, signIn, watchCsp } from "./helpers";

/**
 * The journey the legacy system never completed, end to end through the UI:
 * sign up and confirm by code → book → studio approves and takes payment →
 * the customer sees it paid → cancels → undoes the cancellation.
 *
 * The signup email really goes out (Supabase → Resend SMTP) to a Resend test
 * address that delivers nowhere. The code is then minted with the admin API
 * rather than read from that inbox, so the test needs no mail access.
 */
test("sign up, book, approve, pay, cancel and undo", async ({ browser }) => {
  const db = adminDb();
  const stamp = Date.now();
  const email = `delivered+e2e-${stamp}@resend.dev`;
  const password = `Journey-${stamp}-9aZ`;
  const staff = await createAccount("admin", "journey-admin");
  let customerId: string | null = null;

  try {
    // ---------------------------------------------------------------- sign up
    const visitor = await browser.newPage();
    const visitorCsp = watchCsp(visitor);
    await visitor.goto("/signup");
    await visitor.getByLabel("Full name").fill("Journey Tester");
    await visitor.getByLabel("Email", { exact: true }).fill(email);
    await visitor.getByLabel("Password", { exact: true }).fill(password);
    await visitor.getByLabel("Confirm password").fill(password);
    await visitor.getByLabel(/booking terms/).check();
    await visitor.getByRole("button", { name: "Create account" }).click();
    await expect(visitor).toHaveURL(/\/verify\?email=/);

    const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    customerId = link.user.id;
    await visitor.getByLabel("6-digit code").fill(link.properties.email_otp);
    await visitor.getByRole("button", { name: "Verify email" }).click();
    await expect(visitor).toHaveURL(/\/account/);

    // ---------------------------------------------------------------- book
    await visitor.goto("/book?package=pro-portraits");
    await visitor.getByLabel("Date").fill(bookableDate(10));
    const firstSlot = visitor.locator("section", { hasText: "Pick a date and time" }).getByRole("button").first();
    await firstSlot.click();
    await visitor.getByRole("button", { name: "Request this booking" }).click();
    await expect(visitor).toHaveURL(/\/account\/bookings\/[0-9a-f-]{36}\?created=1/);
    const bookingId = visitor.url().match(/bookings\/([0-9a-f-]{36})/)![1];
    await expect(visitor.getByText("Request received.")).toBeVisible();

    // ---------------------------------------------------------------- studio
    const desk = await browser.newPage();
    const deskCsp = watchCsp(desk);
    await signIn(desk, staff.email, staff.password);
    await desk.goto(`/admin/bookings/${bookingId}`);
    await desk.getByRole("button", { name: "Approve" }).click();
    await expect(desk.getByText("Booking approved.")).toBeVisible();
    // The amount is prefilled with the balance.
    await desk.getByRole("button", { name: "Record payment" }).click();
    // Fully paid: the form turns to refunds, the only entry still possible.
    await expect(desk.getByText("Payment recorded.")).toBeVisible();
    await expect(desk.getByRole("button", { name: "Record refund" })).toBeVisible();
    await expect(desk.locator("header").getByText("Paid", { exact: true })).toBeVisible();

    // ---------------------------------------------------------------- customer
    await visitor.goto(`/account/bookings/${bookingId}`);
    await expect(visitor.getByText("Paid", { exact: true })).toBeVisible();
    visitor.once("dialog", (dialog) => dialog.accept());
    await visitor.getByRole("button", { name: "Cancel booking" }).click();
    const undo = visitor.getByRole("button", { name: /Undo cancellation/ });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(visitor.getByText("Booking restored.")).toBeVisible();

    const { data: booking } = await db.from("bookings").select("status").eq("id", bookingId).single();
    expect(booking?.status).toBe("approved");
    const { data: events } = await db.from("booking_events").select("type").eq("booking_id", bookingId).order("created_at");
    expect(events?.map((e) => e.type)).toEqual(["created", "status_changed", "payment_recorded", "cancelled", "undo_cancel"]);

    // The security headers blocked nothing the journey needed (Supabase calls
    // from the browser, images, fonts, inline bootstrap scripts).
    expect([...visitorCsp, ...deskCsp]).toEqual([]);
  } finally {
    if (customerId) await deleteAccount(customerId);
    await deleteAccount(staff.id);
  }
});
