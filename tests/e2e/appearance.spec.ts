import { expect, test } from "@playwright/test";
import { evidence } from "./qa-helpers";

/**
 * QA-authored. The Light / System / Dark appearance setting (in the footer):
 *   TC-UI-01  choosing Dark applies at once and is still there after a reload
 *   TC-UI-02  choosing Light, then System, switches and clears the saved choice
 */

const KEY = "jr-theme";

async function choose(page: import("@playwright/test").Page, label: "Light" | "System" | "Dark") {
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.locator(`footer label[title="${label}"]`).click();
}

test("TC-UI-01: choosing Dark applies at once and is still there after a reload", async ({ page }, testInfo) => {
  await page.goto("/about");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");

  await choose(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("dark");
  await evidence(page, testInfo, "TC-UI-01-dark");

  // After a reload, and on another page, it is still dark.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/contact");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('footer input[type="radio"][value="dark"]')).toBeChecked();
});

test("TC-UI-02: choosing Light, then System, switches and clears the saved choice", async ({ page }, testInfo) => {
  await page.goto("/about");

  await choose(page, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("light");
  await evidence(page, testInfo, "TC-UI-02-light");

  await choose(page, "System");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();

  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await expect(page.locator('footer input[type="radio"][value="system"]')).toBeChecked();
});
