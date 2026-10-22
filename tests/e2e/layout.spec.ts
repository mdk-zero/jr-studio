import { expect, test } from "@playwright/test";
import { createAccount, deleteAccount, signIn, watchCsp } from "./helpers";

/**
 * Phone-width layout: no page may scroll sideways, and the public pages must
 * still be reachable from the header. Runs in the "phone" project (Pixel 7).
 */
async function sidewaysOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

const PUBLIC = ["/", "/portfolio", "/about", "/contact", "/packages/pro-portraits", "/login", "/signup", "/book"];
const ADMIN = [
  "/admin",
  "/admin/bookings",
  "/admin/bookings/calendar",
  "/admin/bookings/new",
  "/admin/payments",
  "/admin/customers",
  "/admin/messages",
  "/admin/testimonials",
  "/admin/portfolio",
  "/admin/catalog/packages",
  "/admin/staff",
  "/admin/settings",
];

test("public pages fit a phone and link to each other", async ({ page }) => {
  const csp = watchCsp(page);
  for (const path of PUBLIC) {
    await page.goto(path);
    expect(await sidewaysOverflow(page), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  const siteNav = page.getByRole("navigation", { name: "Site" });
  for (const label of ["Portfolio", "About", "Contact"]) {
    await expect(siteNav.getByRole("link", { name: label })).toBeVisible();
  }
  expect(csp).toEqual([]);
});

test("back-office pages fit a phone", async ({ page }) => {
  const admin = await createAccount("admin", "layout-admin");
  const csp = watchCsp(page);
  try {
    await signIn(page, admin.email, admin.password);
    for (const path of ADMIN) {
      await page.goto(path);
      expect(await sidewaysOverflow(page), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
    expect(csp).toEqual([]);

    // The sidebar marks the current section, including on its sub-pages.
    await page.goto("/admin/catalog/addons");
    const sidebar = page.getByRole("navigation", { name: "Back office" });
    await expect(sidebar.getByRole("link", { name: "Catalog" })).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current", "page");
  } finally {
    await deleteAccount(admin.id);
  }
});
