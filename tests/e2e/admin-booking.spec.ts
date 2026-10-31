import { expect, test } from "@playwright/test";
import { toManilaDateString } from "@/lib/datetime";
import { adminDb, bookableDate, createAccount, deleteAccount, signIn } from "./helpers";
import { createCustomerBooking, evidence } from "./qa-helpers";

/**
 * QA-authored. The studio handling a customer's request:
 *   TC-ADM-01  decline a pending booking
 *   TC-ADM-02  reschedule a booking to another day
 *
 * The customer's booking is set up through the database API; the part under
 * test, the back office, is driven through the browser.
 */

test("TC-ADM-01: the studio declines a pending booking", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "decline-customer");
  const admin = await createAccount("admin", "decline-admin");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 12);

    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);
    await expect(page.locator("header").getByText("Pending", { exact: true })).toBeVisible();
    await evidence(page, testInfo, "TC-ADM-01-before-decline");

    // The page has two note fields (status and payment); this is the status one.
    await page.getByRole("textbox", { name: "Note (optional)", exact: true }).fill("No crew available that day");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Decline" }).click();

    await expect(page.getByText("Booking declined.")).toBeVisible();
    await expect(page.locator("header").getByText("Rejected", { exact: true })).toBeVisible();
    // A declined booking is final: no further status buttons.
    await expect(page.getByText("This booking is final")).toBeVisible();
    await evidence(page, testInfo, "TC-ADM-01-declined");

    const { data } = await adminDb().from("bookings").select("status").eq("id", booking.id).single();
    expect(data?.status).toBe("rejected");
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});

test("TC-ADM-02: the studio moves a booking to another day", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "move-customer");
  const admin = await createAccount("admin", "move-admin");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 13);
    const newDate = bookableDate(17);

    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);

    await page.getByLabel("New date").fill(newDate);
    await page.getByRole("group", { name: "Available times" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Move booking" }).click();
    await expect(page.getByText(/^Booking moved\./)).toBeVisible();
    await evidence(page, testInfo, "TC-ADM-02-moved");

    const db = adminDb();
    const { data: moved } = await db.from("bookings").select("starts_at").eq("id", booking.id).single();
    expect(moved?.starts_at).not.toBe(booking.startsAt);
    expect(toManilaDateString(new Date(moved!.starts_at))).toBe(newDate);

    // The change is recorded in the booking's history.
    const { data: events } = await db.from("booking_events").select("type").eq("booking_id", booking.id);
    expect(events?.map((e) => e.type)).toContain("rescheduled");
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});
