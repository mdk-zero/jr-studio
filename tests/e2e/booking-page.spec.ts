import { expect, test, type Page } from "@playwright/test";
import { addDaysToDateString, formatManilaTime, manilaToday } from "@/lib/datetime";
import { adminDb, bookableDate, createAccount, deleteAccount, signIn } from "./helpers";
import { createCustomerBooking, evidence } from "./qa-helpers";

/**
 * QA-authored. The customer's booking page (/book):
 *   TC-BOOK-01  nothing can be requested until a package, date and time are chosen
 *   TC-BOOK-02  an add-on is added to the total
 *   TC-BOOK-03  a running promotion shows as a discount
 *   TC-BOOK-04  a package with no promotion shows no discount
 *   TC-BOOK-05  Sundays (closed) offer no times
 *   TC-BOOK-06  the date picker stops at today and at the booking limit
 *   TC-BOOK-07  a time that is already booked is not offered again
 */

/** The number in a "₱1,234.00" style total. */
function pesos(text: string | null): number {
  return Number((text ?? "").replace(/[^0-9.]/g, ""));
}

function total(page: Page) {
  return page.locator("aside dl").getByText("Total", { exact: true }).locator("xpath=following-sibling::dd");
}

/** The next Sunday after `days` days from now, as a Manila date. */
function nextSunday(days: number): string {
  for (let d = days; d < days + 8; d++) {
    const date = addDaysToDateString(manilaToday(), d);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) return date;
  }
  throw new Error("no Sunday found");
}

test("TC-BOOK-01: nothing can be requested until a package, date and time are chosen", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "book-steps");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book");

    // Step 1: no package yet, so there is no request button at all.
    await expect(page.getByText("Choose a package to begin.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request this booking" })).toHaveCount(0);

    // Step 2: a package is chosen; the button exists but cannot be used yet.
    await page.locator("label", { hasText: "Pro Portraits" }).first().click();
    const request = page.getByRole("button", { name: "Request this booking" });
    await expect(request).toBeDisabled();

    // Step 3: a date with times; still no time chosen.
    await page.getByLabel("Date").fill(bookableDate(21));
    const times = page.locator("section", { hasText: "Pick a date and time" }).getByRole("button");
    await expect(times.first()).toBeVisible();
    await expect(request).toBeDisabled();
    await evidence(page, testInfo, "TC-BOOK-01-before-time");

    // Step 4: a time is chosen and the request can be sent.
    await times.first().click();
    await expect(request).toBeEnabled();
    await evidence(page, testInfo, "TC-BOOK-01-time-chosen");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-BOOK-02: an add-on is added to the total", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "book-addon");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book?package=pro-portraits");

    await expect(total(page)).toBeVisible();
    const before = pesos(await total(page).textContent());

    // The add-on's own price is shown next to it.
    const addon = page.locator("label", { hasText: "Additional Outfit" });
    const addonPrice = pesos(await addon.innerText());
    await addon.getByRole("checkbox").check();
    await expect(page.locator("aside").getByText("Additional Outfit")).toBeVisible();
    await expect.poll(async () => pesos(await total(page).textContent())).toBeGreaterThan(before);
    await evidence(page, testInfo, "TC-BOOK-02-addon-added");

    // The total went up by the add-on's price, less any discount on it.
    const after = pesos(await total(page).textContent());
    expect(after - before).toBeGreaterThan(0);
    expect(after - before).toBeLessThanOrEqual(addonPrice);

    // Taking it off again returns the total.
    await addon.getByRole("checkbox").uncheck();
    await expect.poll(async () => pesos(await total(page).textContent())).toBe(before);
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-BOOK-03: a running promotion shows as a discount", async ({ page }, testInfo) => {
  const db = adminDb();
  const today = manilaToday();
  const { data: pkg } = await db.from("packages").select("id").eq("slug", "pro-portraits").single();
  const { data: links } = await db.from("promotion_packages").select("promotion_id").eq("package_id", pkg!.id);
  const { data: promos } = await db
    .from("promotions")
    .select("name, discount_percent, starts_on, ends_on")
    .in("id", (links ?? []).map((l) => l.promotion_id))
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("discount_percent", { ascending: false });
  const promo = promos?.[0];
  test.skip(!promo, "No promotion is running for Pro Portraits today, so there is no discount to check.");

  const customer = await createAccount("customer", "book-promo");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book?package=pro-portraits");
    await expect(page.locator("aside").getByText(`Discount (${promo!.discount_percent}%)`)).toBeVisible();
    await evidence(page, testInfo, "TC-BOOK-03-discount");

    // The total is the price less that percentage (Pro Portraits costs 600).
    const expected = 600 * (1 - promo!.discount_percent / 100);
    await expect.poll(async () => pesos(await total(page).textContent())).toBeCloseTo(expected, 1);
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-BOOK-04: a package with no running promotion shows no discount", async ({ page }, testInfo) => {
  const db = adminDb();
  const today = manilaToday();
  const { data: pkg } = await db.from("packages").select("id, price").eq("slug", "corporate-headshots").single();
  const { data: links } = await db.from("promotion_packages").select("promotion_id").eq("package_id", pkg!.id);
  const { data: running } = await db
    .from("promotions")
    .select("id")
    .in("id", (links ?? []).map((l) => l.promotion_id))
    .lte("starts_on", today)
    .gte("ends_on", today);
  test.skip((running ?? []).length > 0, "A promotion is running for Corporate Headshots, so this check does not apply today.");

  const customer = await createAccount("customer", "book-nopromo");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book?package=corporate-headshots");
    await expect(total(page)).toBeVisible();
    await expect(page.locator("aside").getByText(/^Discount/)).toHaveCount(0);
    expect(pesos(await total(page).textContent())).toBe(Number(pkg!.price));
    await evidence(page, testInfo, "TC-BOOK-04-no-discount");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-BOOK-05: a Sunday (studio closed) offers no times", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "book-sunday");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book?package=pro-portraits");
    await page.getByLabel("Date").fill(nextSunday(8));

    await expect(page.getByText(/Nothing free on that date/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Request this booking" })).toBeDisabled();
    await evidence(page, testInfo, "TC-BOOK-05-sunday");
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-BOOK-06: the date picker stops at today and at the booking limit", async ({ page }) => {
  const customer = await createAccount("customer", "book-limits");
  try {
    await signIn(page, customer.email, customer.password);
    await page.goto("/book?package=pro-portraits");

    const date = page.getByLabel("Date");
    await expect(date).toHaveAttribute("min", manilaToday());
    const max = await date.getAttribute("max");
    expect(max, "a last bookable date is set").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(max! > manilaToday()).toBe(true);

    // The server enforces it too: a day in the past has no times to offer.
    await date.fill(addDaysToDateString(manilaToday(), -3));
    await expect(page.getByText(/Nothing free on that date/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Request this booking" })).toBeDisabled();
  } finally {
    await deleteAccount(customer.id);
  }
});

test("TC-BOOK-07: a time that is already booked is not offered again", async ({ page }, testInfo) => {
  const first = await createAccount("customer", "book-taken-a");
  const second = await createAccount("customer", "book-taken-b");
  try {
    const booked = await createCustomerBooking(first, "pro-portraits", 22);
    const takenTime = formatManilaTime(booked.startsAt);

    await signIn(page, second.email, second.password);
    await page.goto("/book?package=pro-portraits");
    await page.getByLabel("Date").fill(booked.date);

    const times = page.locator("section", { hasText: "Pick a date and time" }).getByRole("button");
    await expect(times.first()).toBeVisible();
    const offered = await times.allInnerTexts();
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.map((t) => t.trim())).not.toContain(takenTime);
    await evidence(page, testInfo, "TC-BOOK-07-taken-slot-hidden");
  } finally {
    await deleteAccount(first.id);
    await deleteAccount(second.id);
  }
});
