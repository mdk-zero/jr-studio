import { expect, test } from "@playwright/test";
import { adminDb, createAccount, deleteAccount, signIn } from "./helpers";
import { createCustomerBooking, evidence, observation } from "./qa-helpers";

/**
 * QA-authored. What a signed-in customer can do with their own account:
 *   TC-ACC-01  a new booking is listed under "My bookings"
 *   TC-ACC-02  the customer cancels their own pending booking
 *   TC-ACC-03  another customer's booking cannot be opened
 *   TC-ACC-04  the profile can be changed, and a bad phone number is refused
 */

test("TC-ACC-01: a new booking is listed under My bookings", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "acc-list");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 24);
    await signIn(page, customer.email, customer.password);
    await page.goto("/account");

    const card = page.locator(`a[href="/account/bookings/${booking.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Pro Portraits");
    await expect(card).toContainText("Awaiting confirmation");
    await evidence(page, testInfo, "TC-ACC-01-my-bookings");

    await card.click();
    await expect(page).toHaveURL(new RegExp(`/account/bookings/${booking.id}`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pro Portraits");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-ACC-02: the customer cancels their own pending booking", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "acc-cancel");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 25);
    await signIn(page, customer.email, customer.password);
    await page.goto(`/account/bookings/${booking.id}`);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel booking" }).click();

    await expect(page.getByText("Booking cancelled.")).toBeVisible();
    await expect(page.locator("header").getByText("Cancelled", { exact: true })).toBeVisible();
    // The cancel button is gone, and the undo window is open.
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Undo cancellation/ })).toBeVisible();
    await evidence(page, testInfo, "TC-ACC-02-cancelled");

    const { data } = await adminDb().from("bookings").select("status").eq("id", booking.id).single();
    expect(data?.status).toBe("cancelled");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-ACC-03: another customer's booking cannot be opened", async ({ page }, testInfo) => {
  const owner = await createAccount("customer", "acc-owner");
  const stranger = await createAccount("customer", "acc-stranger");
  try {
    const booking = await createCustomerBooking(owner, "pro-portraits", 26);

    await signIn(page, stranger.email, stranger.password);
    const response = await page.goto(`/account/bookings/${booking.id}`);
    // The page streams, so the HTTP status is already 200 when the "not found"
    // decision is made; what matters is that the booking is not shown.
    await expect(page.getByText(/could not be found|not found/i).first()).toBeVisible();
    await expect(page.getByText("Pro Portraits")).toHaveCount(0);
    await observation(testInfo, "TC-ACC-03-http-status", `HTTP status of the stranger's request: ${response?.status()}
The page body says the booking was not found.`);
    await evidence(page, testInfo, "TC-ACC-03-not-found");

    // And it is not in the stranger's own list.
    await page.goto("/account");
    await expect(page.locator(`a[href="/account/bookings/${booking.id}"]`)).toHaveCount(0);
  } finally {
    await deleteAccount(owner.id);
    await deleteAccount(stranger.id);
  }
});

test("TC-ACC-04: the profile can be changed, and a bad phone number is refused", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "acc-profile");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/account/profile");

    // A phone number that is not a PH mobile number is refused, nothing saved.
    await page.getByLabel("Mobile number").fill("12345");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter a PH mobile number")).toBeVisible();

    // A valid change is saved.
    await page.getByLabel("Full name").fill("QA Renamed Customer");
    await page.getByLabel("Mobile number").fill("09171234567");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
    await evidence(page, testInfo, "TC-ACC-04-profile-saved");

    const { data } = await adminDb()
      .from("customers")
      .select("full_name, phone")
      .eq("profile_id", customer.id)
      .single();
    expect(data).toEqual({ full_name: "QA Renamed Customer", phone: "09171234567" });
  } finally {
    await deleteAccount(customer.id);
  }
});
