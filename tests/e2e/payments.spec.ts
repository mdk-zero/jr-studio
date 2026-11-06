import { expect, test, type Page } from "@playwright/test";
import { adminDb, createAccount, deleteAccount, signIn } from "./helpers";
import { createCustomerBooking, evidence } from "./qa-helpers";

/**
 * QA-authored. Recording money against a booking (staff side):
 *   TC-PAY-01  a part payment leaves the booking "Part paid" with a balance
 *   TC-PAY-02  paying the balance makes it "Paid"
 *   TC-PAY-03  paying more than is owed is refused
 *   TC-PAY-04  a bad amount and a refund larger than what was paid are refused
 *
 * Each test books as a customer, approves the booking (a payment can only be
 * taken on an approved one), then drives the payment form in the browser.
 */

async function approvedBooking(daysAhead: number) {
  const customer = await createAccount("customer", "pay-customer");
  const admin = await createAccount("admin", "pay-admin");
  const booking = await createCustomerBooking(customer, "pro-portraits", daysAhead);
  const { error } = await adminDb().from("bookings").update({ status: "approved" }).eq("id", booking.id);
  if (error) throw error;
  const { data } = await adminDb().from("bookings").select("total_amount").eq("id", booking.id).single();
  return { customer, admin, booking, total: Number(data!.total_amount) };
}

async function paidTotal(bookingId: string): Promise<number> {
  const { data } = await adminDb().from("payments").select("amount, voided_at").eq("booking_id", bookingId);
  return (data ?? []).filter((p) => !p.voided_at).reduce((sum, p) => sum + Number(p.amount), 0);
}

async function record(page: Page, amount: string) {
  await page.locator("#amount").fill(amount);
  await page.getByRole("button", { name: /^Record (payment|refund)$/ }).click();
}

test("TC-PAY-01: a part payment leaves the booking 'Part paid' with a balance", async ({ page }, testInfo) => {
  const { customer, admin, booking, total } = await approvedBooking(34);
  try {
    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);

    await record(page, "100");
    await expect(page.getByText("Payment recorded.")).toBeVisible();
    await expect(page.locator("header").getByText("Part paid", { exact: true })).toBeVisible();
    await evidence(page, testInfo, "TC-PAY-01-part-paid");

    expect(await paidTotal(booking.id)).toBe(100);
    expect(total).toBeGreaterThan(100);

    // The customer's own page shows what was paid and what is left.
    const view = await page.context().browser()!.newPage();
    await signIn(view, customer.email, customer.password);
    await view.goto(`/account/bookings/${booking.id}`);
    await expect(view.getByText("Paid so far")).toBeVisible();
    await expect(view.getByText("Balance", { exact: true })).toBeVisible();
    await view.close();
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});

test("TC-PAY-02: paying the balance makes the booking 'Paid'", async ({ page }, testInfo) => {
  const { customer, admin, booking, total } = await approvedBooking(35);
  try {
    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);

    await record(page, "100");
    await expect(page.getByText("Payment recorded.")).toBeVisible();

    // The amount box is pre-filled with what is still owed; accept it as it is.
    await expect(page.locator("#amount")).toHaveValue((total - 100).toFixed(2));
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.locator("header").getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Paid in full. Nothing left to record.").or(page.getByRole("button", { name: "Record refund" }))).toBeVisible();
    await evidence(page, testInfo, "TC-PAY-02-paid");

    expect(await paidTotal(booking.id)).toBeCloseTo(total, 2);
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});

test("TC-PAY-03: paying more than is owed is refused", async ({ page }, testInfo) => {
  const { customer, admin, booking, total } = await approvedBooking(36);
  try {
    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);

    await record(page, String(Math.ceil(total) + 1000));
    await expect(page.getByText(/more than the .* still owed/)).toBeVisible();
    await evidence(page, testInfo, "TC-PAY-03-overpayment-refused");

    expect(await paidTotal(booking.id)).toBe(0);
    await expect(page.locator("header").getByText("Unpaid", { exact: true })).toBeVisible();
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});

test("TC-PAY-04: a bad amount and a refund larger than what was paid are refused", async ({ page }, testInfo) => {
  const { customer, admin, booking } = await approvedBooking(37);
  try {
    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);

    // Not a number.
    await record(page, "abc");
    await expect(page.getByText("Enter an amount like 1500 or 1500.50")).toBeVisible();
    // Zero.
    await record(page, "0");
    await expect(page.getByText("Enter an amount above zero")).toBeVisible();
    expect(await paidTotal(booking.id)).toBe(0);

    // Take 100, then try to give back more than that.
    await record(page, "100");
    await expect(page.getByText("Payment recorded.")).toBeVisible();
    await page.getByRole("radio", { name: "Refund given" }).click();
    await record(page, "500");
    await expect(page.getByText(/A refund cannot be more than/)).toBeVisible();
    await evidence(page, testInfo, "TC-PAY-04-refund-too-large");
    expect(await paidTotal(booking.id)).toBe(100);

    // A refund within what was paid works.
    await record(page, "40");
    await expect(page.getByText("Refund recorded.")).toBeVisible();
    expect(await paidTotal(booking.id)).toBe(60);
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});
