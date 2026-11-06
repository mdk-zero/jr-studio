import { expect, test } from "@playwright/test";
import { adminDb, createAccount, deleteAccount } from "./helpers";
import { evidence, observation } from "./qa-helpers";

/**
 * QA-authored. Creating an account and recovering a password. A successful
 * sign-up is already covered end to end by TC-E2E-01, so these are the cases
 * where the form must say no:
 *   TC-REG-01  an empty form shows an error on every required field
 *   TC-REG-02  a password that is too weak is refused
 *   TC-REG-03  two different passwords are refused
 *   TC-REG-04  an email that already has an account does not get a second one
 *   TC-REG-05  "forgot password" gives the same answer for an unknown email
 */

async function fillSignUp(
  page: import("@playwright/test").Page,
  values: { name?: string; email?: string; password?: string; confirm?: string; terms?: boolean },
) {
  await page.goto("/signup");
  if (values.name !== undefined) await page.getByLabel("Full name").fill(values.name);
  if (values.email !== undefined) await page.getByLabel("Email", { exact: true }).fill(values.email);
  if (values.password !== undefined) await page.getByLabel("Password", { exact: true }).fill(values.password);
  if (values.confirm !== undefined) await page.getByLabel("Confirm password").fill(values.confirm);
  if (values.terms) await page.getByLabel(/booking terms/).check();
  await page.getByRole("button", { name: "Create account" }).click();
}

test("TC-REG-01: an empty sign-up form shows an error on every required field", async ({ page }, testInfo) => {
  await fillSignUp(page, {});

  await expect(page.getByText("Enter your full name")).toBeVisible();
  await expect(page.getByText("Enter a valid email address").or(page.getByText("Email is required")).first()).toBeVisible();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  await expect(page.getByText("Please accept the terms to continue")).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
  await evidence(page, testInfo, "TC-REG-01-empty-form", { fullPage: true });
});

test("TC-REG-02: a password that is too weak is refused", async ({ page }, testInfo) => {
  const email = `e2e-weak-${Date.now()}@example.com`;
  try {
    // No capital letter (the form shows the first problem it finds).
    await fillSignUp(page, { name: "Weak Password", email, password: "alllowercase1", confirm: "alllowercase1", terms: true });
    await expect(page.getByText("Include an uppercase letter")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
    await evidence(page, testInfo, "TC-REG-02-weak-password", { fullPage: true });

    // No number.
    await fillSignUp(page, { name: "Weak Password", email, password: "NoNumbersHere", confirm: "NoNumbersHere", terms: true });
    await expect(page.getByText("Include a number")).toBeVisible();

    // Too short.
    await fillSignUp(page, { name: "Weak Password", email, password: "Ab1", confirm: "Ab1", terms: true });
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();

    // Nothing was created.
    const { data } = await adminDb().auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.some((u) => u.email === email)).toBe(false);
  } finally {
    // Nothing to clean up: no account is made by a refused sign-up.
  }
});

test("TC-REG-03: two different passwords are refused", async ({ page }, testInfo) => {
  await fillSignUp(page, {
    name: "Mismatch Tester",
    email: `e2e-mismatch-${Date.now()}@example.com`,
    password: "Valid-Pass-123",
    confirm: "Valid-Pass-124",
    terms: true,
  });
  await expect(page.getByText("Passwords do not match")).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
  await evidence(page, testInfo, "TC-REG-03-mismatch", { fullPage: true });
});

test("TC-REG-04: an email that already has an account does not get a second one", async ({ page }, testInfo) => {
  const existing = await createAccount("customer", "duplicate");
  try {
    await fillSignUp(page, {
      name: "Second Attempt",
      email: existing.email,
      password: "Another-Pass-123",
      confirm: "Another-Pass-123",
      terms: true,
    });
    // Give the server time to answer, whatever the page shows.
    await page.waitForLoadState("networkidle");
    await observation(testInfo, "TC-REG-04-what-the-page-showed", `URL after submit: ${page.url()}\n\n${(await page.locator("main").innerText()).slice(0, 600)}`);
    await evidence(page, testInfo, "TC-REG-04-duplicate-email");

    // Whatever the page says, there is still exactly one account for that email,
    // and the original password still works.
    const { data } = await adminDb().auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.filter((u) => u.email === existing.email)).toHaveLength(1);

    await page.goto("/login");
    await page.getByLabel("Email").fill(existing.email);
    await page.getByLabel("Password").fill(existing.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/);
  } finally {
    await deleteAccount(existing.id);
  }
});

test("TC-REG-05: 'forgot password' gives the same answer for an unknown email", async ({ page }, testInfo) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(`e2e-nobody-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  // The answer must not reveal whether the address has an account.
  await expect(page.getByText("If that email is registered, a reset link is on its way.")).toBeVisible();
  await evidence(page, testInfo, "TC-REG-05-forgot-password");

  // An invalid address is refused before anything is sent.
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
});
