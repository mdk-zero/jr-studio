import { expect, test } from "@playwright/test";
import { adminDb, bookableDate, createAccount, deleteAccount, signIn } from "./helpers";
import { deleteCustomerByEmail, evidence } from "./qa-helpers";

/**
 * QA-authored. TC-WALK-01: the studio books a walk-in customer (no account) at
 * /admin/bookings/new. Studio bookings are approved straight away.
 */

test("TC-WALK-01: the studio books a walk-in customer", async ({ page }, testInfo) => {
  const admin = await createAccount("admin", "walkin-admin");
  const stamp = Date.now();
  const email = `e2e-walkin-${stamp}@example.com`;
  try {
    await signIn(page, admin.email, admin.password);
    await page.goto("/admin/bookings/new");

    // Until a customer and a time are chosen the button cannot be used.
    await expect(page.getByRole("button", { name: "Book and approve" })).toBeDisabled();

    await page.getByRole("radio", { name: "New walk-in" }).click();
    await page.getByLabel("Full name").fill("Walk-in Tester");
    await page.getByLabel("Email", { exact: true }).fill(email);

    const packageValue = await page.locator("#package option", { hasText: "Pro Portraits" }).first().getAttribute("value");
    await page.locator("#package").selectOption(packageValue!);

    await page.getByLabel("Date", { exact: true }).fill(bookableDate(14));
    await page.getByRole("group", { name: "Available times" }).getByRole("button").first().click();

    await expect(page.getByRole("button", { name: "Book and approve" })).toBeEnabled();
    await evidence(page, testInfo, "TC-WALK-01-form-filled");
    await page.getByRole("button", { name: "Book and approve" }).click();
    await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}\?created=1/);
    await expect(page.getByText("Booked and approved.")).toBeVisible();
    await expect(page.getByText("Walk-in (no login)")).toBeVisible();
    await evidence(page, testInfo, "TC-WALK-01-booked");

    const bookingId = page.url().match(/bookings\/([0-9a-f-]{36})/)![1];
    const { data } = await adminDb().from("bookings").select("status, source").eq("id", bookingId).single();
    expect(data).toEqual({ status: "approved", source: "admin" });
  } finally {
    await deleteCustomerByEmail(email);
    await deleteAccount(admin.id);
  }
});
