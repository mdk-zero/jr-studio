import { expect, test } from "@playwright/test";
import { addDaysToDateString, manilaToday } from "@/lib/datetime";
import { adminDb, createAccount, deleteAccount, signIn } from "./helpers";
import { createCustomerBooking, evidence } from "./qa-helpers";

/**
 * QA-authored. The back office, beyond the decline / reschedule / walk-in
 * cases already covered (TC-ADM-01, TC-ADM-02, TC-WALK-01):
 *   TC-DESK-01  the studio approves a pending booking
 *   TC-DESK-02  a contact message is marked read and the "Unread" filter follows
 *   TC-DESK-03  the booking list can be searched and filtered
 *   TC-DESK-04  a promotion is created, listed as upcoming, and deleted
 *   TC-DESK-05  a staff account cannot open the admin-only pages
 *   TC-DESK-06  the catalogue pages list the packages, add-ons and promotions
 */

test("TC-DESK-01: the studio approves a pending booking", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "desk-approve-c");
  const admin = await createAccount("admin", "desk-approve-a");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 32);
    await signIn(page, admin.email, admin.password);
    await page.goto(`/admin/bookings/${booking.id}`);
    await expect(page.locator("header").getByText("Pending", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Booking approved.")).toBeVisible();
    await expect(page.locator("header").getByText("Approved", { exact: true })).toBeVisible();
    await evidence(page, testInfo, "TC-DESK-01-approved");

    const { data } = await adminDb().from("bookings").select("status").eq("id", booking.id).single();
    expect(data?.status).toBe("approved");

    // The customer sees the same on their side.
    const view = await page.context().browser()!.newPage();
    await signIn(view, customer.email, customer.password);
    await view.goto(`/account/bookings/${booking.id}`);
    await expect(view.locator("header").getByText("Confirmed", { exact: true })).toBeVisible();
    await view.close();
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});

test("TC-DESK-02: a contact message is marked read and the Unread filter follows", async ({ page }, testInfo) => {
  const admin = await createAccount("admin", "desk-messages");
  const email = `e2e-desk-message-${Date.now()}@example.com`;
  const text = `Desk message ${Date.now()} about a baby milestone shoot.`;
  try {
    await adminDb().from("contact_messages").insert({ name: "Desk Tester", email, message: text });

    await signIn(page, admin.email, admin.password);
    await page.goto("/admin/messages?filter=unread");
    const item = page.locator("li", { hasText: text });
    await expect(item).toBeVisible();
    await expect(item.getByLabel("Unread")).toBeVisible();
    await evidence(page, testInfo, "TC-DESK-02-unread");

    await item.getByRole("button", { name: "Mark read" }).click();
    await expect.poll(async () => (await adminDb().from("contact_messages").select("is_read").eq("email", email).single()).data?.is_read).toBe(true);

    // It no longer shows under Unread, but is still under All.
    await page.goto("/admin/messages?filter=unread");
    await expect(page.locator("li", { hasText: text })).toHaveCount(0);
    await page.goto("/admin/messages");
    const read = page.locator("li", { hasText: text });
    await expect(read).toBeVisible();
    await expect(read.getByRole("button", { name: "Mark unread" })).toBeVisible();
    await evidence(page, testInfo, "TC-DESK-02-read");
  } finally {
    await adminDb().from("contact_messages").delete().eq("email", email);
    await deleteAccount(admin.id);
  }
});

test("TC-DESK-03: the booking list can be searched and filtered", async ({ page }, testInfo) => {
  const customer = await createAccount("customer", "desk-search-c");
  const admin = await createAccount("admin", "desk-search-a");
  try {
    const booking = await createCustomerBooking(customer, "pro-portraits", 33);
    const { data } = await adminDb().from("bookings").select("reference").eq("id", booking.id).single();
    const reference = data!.reference;

    await signIn(page, admin.email, admin.password);
    const row = page.locator(`a[href="/admin/bookings/${booking.id}"]`);

    // Searching by reference finds it (upcoming, any status).
    await page.goto(`/admin/bookings?q=${encodeURIComponent(reference)}`);
    await expect(row.first()).toBeVisible();
    await evidence(page, testInfo, "TC-DESK-03-search-found");

    // Filtering for a status it does not have hides it.
    await page.goto(`/admin/bookings?q=${encodeURIComponent(reference)}&status=completed`);
    await expect(row).toHaveCount(0);

    // And the right status shows it again.
    await page.goto(`/admin/bookings?q=${encodeURIComponent(reference)}&status=pending`);
    await expect(row.first()).toBeVisible();
  } finally {
    await deleteAccount(customer.id);
    await deleteAccount(admin.id);
  }
});

test("TC-DESK-04: a promotion is created, listed as upcoming, and deleted", async ({ page }, testInfo) => {
  const admin = await createAccount("admin", "desk-promo");
  const name = `QA Promo ${Date.now()}`;
  try {
    await signIn(page, admin.email, admin.password);
    await page.goto("/admin/catalog/promos");

    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Discount (%)").fill("5");
    // Far enough ahead that it never touches a real booking price.
    await page.getByLabel("Starts").fill(addDaysToDateString(manilaToday(), 300));
    await page.getByLabel("Ends").fill(addDaysToDateString(manilaToday(), 310));
    await page.getByLabel("Pro Portraits").check();
    await page.getByRole("button", { name: "Add promotion" }).click();

    const row = page.locator("tr", { hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText("upcoming", { exact: true })).toBeVisible();
    await expect(row.getByText("5%")).toBeVisible();
    await evidence(page, testInfo, "TC-DESK-04-created");

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tr", { hasText: name })).toHaveCount(0);

    const { data } = await adminDb().from("promotions").select("id").eq("name", name);
    expect(data).toHaveLength(0);
  } finally {
    await adminDb().from("promotions").delete().eq("name", name);
    await deleteAccount(admin.id);
  }
});

test("TC-DESK-05: a staff account cannot open the admin-only pages", async ({ page }, testInfo) => {
  const staff = await createAccount("staff", "desk-staff");
  try {
    await signIn(page, staff.email, staff.password);

    // Staff can work the bookings desk.
    await page.goto("/admin/bookings");
    await expect(page).toHaveURL(/\/admin\/bookings/);
    await expect(page.getByRole("heading", { name: "Bookings", level: 1 })).toBeVisible();

    // But the admin-only pages send them back to the dashboard.
    for (const path of ["/admin/staff", "/admin/settings", "/admin/catalog/promos", "/admin/catalog/packages"]) {
      await page.goto(path);
      await expect(page, `${path} should not open for staff`).not.toHaveURL(new RegExp(`${path}$`));
      await expect(page).toHaveURL(/\/admin\/?$/);
    }
    await evidence(page, testInfo, "TC-DESK-05-sent-back");
  } finally {
    await deleteAccount(staff.id);
  }
});

test("TC-DESK-06: the catalogue pages list the packages, add-ons and promotions", async ({ page }, testInfo) => {
  const admin = await createAccount("admin", "desk-catalog");
  try {
    await signIn(page, admin.email, admin.password);

    await page.goto("/admin/catalog/packages");
    await expect(page.getByText("Pro Portraits").first()).toBeVisible();
    await expect(page.getByText("Magazine Concept").first()).toBeVisible();
    await evidence(page, testInfo, "TC-DESK-06-packages");

    await page.goto("/admin/catalog/addons");
    await expect(page.getByText("Additional Outfit").first()).toBeVisible();

    await page.goto("/admin/catalog/promos");
    await expect(page.getByRole("heading", { name: "Promotions", level: 1 })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  } finally {
    await deleteAccount(admin.id);
  }
});
