import { expect, test, type Page } from "@playwright/test";
import { adminDb, bookableDate, createAccount, deleteAccount, signIn } from "./helpers";
import { createCustomerBooking, evidence } from "./qa-helpers";

/**
 * QA-authored. Customer tasks on a phone (the "phone" project, Pixel 7):
 *   TC-UI-03  a customer requests a booking from a phone
 *   TC-UI-04  a customer finds and reads a booking on a phone
 * (Page widths alone are already checked by TC-LAY-01 and TC-LAY-02.)
 */

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test("TC-UI-03: a customer requests a booking from a phone", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "phone-book");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book?package=pro-portraits");

    await page.getByLabel("Date").fill(bookableDate(38));
    const times = page.locator("section", { hasText: "Pick a date and time" }).getByRole("button");
    await expect(times.first()).toBeVisible();
    await times.first().click();
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

    const request = page.getByRole("button", { name: "Request this booking" });
    await request.scrollIntoViewIfNeeded();
    await expect(request).toBeEnabled();
    await evidence(page, testInfo, "TC-UI-03-phone-booking-ready");
    await request.click();

    await expect(page).toHaveURL(/\/account\/bookings\/[0-9a-f-]{36}\?created=1/);
    await expect(page.getByText("Request received.")).toBeVisible();
    await evidence(page, testInfo, "TC-UI-03-phone-booking-sent");

    const id = page.url().match(/bookings\/([0-9a-f-]{36})/)![1];
    const { data } = await adminDb().from("bookings").select("status").eq("id", id).single();
    expect(data?.status).toBe("pending");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-UI-04: a customer finds and reads a booking on a phone", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "phone-read");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 39);

    // Sign in through the form on the phone.
    await page.goto("/login");
    await page.getByLabel("Email").fill(customer.email);
    await page.getByLabel("Password").fill(customer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/);
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

    const card = page.locator(`a[href="/account/bookings/${booking.id}"]`);
    await expect(card).toBeVisible();
    await evidence(page, testInfo, "TC-UI-04-phone-list");
    await card.click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pro Portraits");
    await expect(page.getByRole("button", { name: "Cancel booking" })).toBeVisible();
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    await evidence(page, testInfo, "TC-UI-04-phone-booking");
  } finally {
    await deleteAccount(customer.id);
  }
});
