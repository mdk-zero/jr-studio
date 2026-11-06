import { expect, test } from "@playwright/test";
import { adminDb } from "./helpers";
import { evidence, observation } from "./qa-helpers";

/**
 * QA-authored. What a visitor who is not signed in can reach:
 *   TC-PUB-01  the public pages load and show their heading
 *   TC-PUB-02  a package page shows its details and its booking link asks a visitor to sign in
 *   TC-PUB-03  an unknown address shows the "not found" page
 *   TC-PUB-04  the header links lead to the right pages
 *   TC-PUB-05  the footer shows the studio's hours and contact details
 */

test("TC-PUB-01: the public pages load and show their heading", async ({ page }, testInfo) => {
  const pages: Array<{ path: string; heading: RegExp }> = [
    { path: "/", heading: /Stills/ },
    { path: "/portfolio", heading: /^Portfolio$/ },
    { path: "/about", heading: /^About / },
    { path: "/contact", heading: /^Contact$/ },
    { path: "/login", heading: /^Welcome back$/ },
    { path: "/signup", heading: /^Create your account$/ },
    { path: "/forgot-password", heading: /^Reset your password$/ },
  ];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const { path, heading } of pages) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 }).first(), `${path} heading`).toHaveText(heading);
  }
  expect(errors, "script errors while browsing").toEqual([]);
  await evidence(page, testInfo, "TC-PUB-01-last-page");
});

test("TC-PUB-02: a package page shows its details and its booking link asks a visitor to sign in", async ({ page }, testInfo) => {
  const { data } = await adminDb().from("packages").select("slug, name").eq("slug", "pro-portraits").single();
  expect(data, "seed package exists").not.toBeNull();

  await page.goto(`/packages/${data!.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(data!.name);
  await expect(page.getByText("Duration", { exact: true })).toBeVisible();
  await evidence(page, testInfo, "TC-PUB-02-package-page");

  // Booking needs an account, so a visitor who is not signed in is sent to
  // the sign-in page first and returns to the booking page afterwards.
  await page.locator(`a[href="/book?package=${data!.slug}"]`).first().click();
  await expect(page).toHaveURL(/\/login\?next=%2Fbook/);
  await observation(
    testInfo,
    "TC-PUB-02-booking-link-redirect",
    `Clicked the booking link for ${data!.slug} while signed out.
Landed on: ${page.url()}
The ?package= part of the link is not in the "next" address.`,
  );
});

test("TC-PUB-03: an unknown address shows the not-found page", async ({ page }, testInfo) => {
  const missingPackage = await page.goto("/packages/this-package-does-not-exist");
  expect(missingPackage?.status()).toBe(404);
  await expect(page.getByText(/could not be found|not found/i).first()).toBeVisible();

  const missingPage = await page.goto("/no-such-page-qa");
  expect(missingPage?.status()).toBe(404);
  await expect(page.getByText(/could not be found|not found/i).first()).toBeVisible();
  await evidence(page, testInfo, "TC-PUB-03-not-found");
});

test("TC-PUB-04: the header links lead to the right pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Site" }).first();

  for (const [label, path] of [
    ["Portfolio", "/portfolio"],
    ["About", "/about"],
    ["Contact", "/contact"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }

  // The logo takes the visitor home again.
  await page.getByRole("link", { name: "J&R Studio, home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("TC-PUB-05: the footer shows the studio's hours and contact details", async ({ page }, testInfo) => {
  await page.goto("/contact");
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText("Studio hours")).toBeVisible();
  await expect(footer.getByText("Get in touch")).toBeVisible();
  await expect(footer.getByText(/Nasugbu, Batangas/).first()).toBeVisible();
  await evidence(page, testInfo, "TC-PUB-05-footer");
});
