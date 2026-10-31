import { expect, test } from "@playwright/test";
import { createAccount, deleteAccount, signIn } from "./helpers";
import { evidence, observation } from "./qa-helpers";

/**
 * QA-authored. Login and role access:
 *   TC-AUTH-01  a wrong password is refused, the right one signs a customer in
 *   TC-AUTH-02  a signed-out visitor cannot open the protected areas
 *   TC-AUTH-03  a customer cannot open the back office, an admin can, sign-out works
 */

test("TC-AUTH-01: wrong password is refused, correct password signs a customer in", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "auth-customer");
  try {
    await page.goto("/login");

    // Wrong password: an error, and still on the sign-in page.
    await page.getByLabel("Email").fill(customer.email);
    await page.getByLabel("Password").fill(`${customer.password}-wrong`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await evidence(page, testInfo, "TC-AUTH-01-wrong-password");

    // Right password: lands in the customer's own area.
    await page.getByLabel("Password").fill(customer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: /^Hello,/ })).toBeVisible();
    await evidence(page, testInfo, "TC-AUTH-01-signed-in");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-AUTH-02: a signed-out visitor is sent to sign in", async ({ page }, testInfo) => {
  const seen: string[] = [];
  for (const path of ["/admin", "/account", "/book"]) {
    await page.goto(path);
    // The page they asked for is remembered, so they return to it after signing in.
    await expect(page, `${path} should require sign-in`).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(path)}`),
    );
    const landed = new URL(page.url());
    seen.push(`${path}  ->  ${landed.pathname}${landed.search}`);
  }
  await observation(testInfo, "TC-AUTH-02-redirects", `Requested  ->  Where the browser ended up\n${seen.join("\n")}\n`);
});

test("TC-AUTH-03: a customer cannot open the back office, an admin can, and sign-out works", async ({ browser }, testInfo) => {
  const customer = await createAccount("customer", "access-customer");
  const admin = await createAccount("admin", "access-admin");
  try {
    // Customer: /admin bounces back to their own area.
    const customerPage = await browser.newPage();
    await signIn(customerPage, customer.email, customer.password);
    await customerPage.goto("/admin");
    await expect(customerPage).toHaveURL(/\/account/);
    await expect(customerPage.getByRole("navigation", { name: "Back office" })).toHaveCount(0);
    await evidence(customerPage, testInfo, "TC-AUTH-03-customer-sent-to-account");

    // Admin: the back office opens.
    const adminPage = await browser.newPage();
    await signIn(adminPage, admin.email, admin.password);
    await adminPage.goto("/admin");
    await expect(adminPage).toHaveURL(/\/admin$/);
    await expect(adminPage.getByRole("navigation", { name: "Back office" })).toBeVisible();
    await evidence(adminPage, testInfo, "TC-AUTH-03-admin-back-office");

    // Signing out ends the session: the customer area is closed again.
    await customerPage.getByRole("button", { name: "Sign out" }).first().click();
    await expect(customerPage).toHaveURL(/\/$/);
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/login\?next=/);
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});
