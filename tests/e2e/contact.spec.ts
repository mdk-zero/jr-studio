import { expect, test } from "@playwright/test";
import { adminDb, createAccount, deleteAccount, signIn } from "./helpers";
import { deleteContactMessages, evidence } from "./qa-helpers";

/**
 * QA-authored. The public contact form:
 *   TC-CONTACT-01  an empty form is refused and nothing is saved
 *   TC-CONTACT-02  a message is accepted and reaches the admin inbox
 */

test("TC-CONTACT-01: an empty contact form is refused", async ({ page }, testInfo) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Tell us a little more (at least 10 characters)")).toBeVisible();
  await expect(page.getByText("Thank you!")).toHaveCount(0);
  await evidence(page, testInfo, "TC-CONTACT-01-validation-errors", { fullPage: true });
});

test("TC-CONTACT-02: a message is accepted and reaches the admin inbox", async ({ browser }, testInfo) => {
  const admin = await createAccount("admin", "contact-admin");
  const stamp = Date.now();
  const email = `e2e-contact-${stamp}@example.com`;
  const message = `Automated QA message ${stamp}: asking about a prenup shoot in December.`;
  try {
    // A visitor sends the message.
    const visitor = await browser.newPage();
    await visitor.goto("/contact");
    await visitor.getByLabel("Your name").fill("Contact Tester");
    await visitor.getByLabel("Email", { exact: true }).fill(email);
    await visitor.getByLabel("Message").fill(message);
    await visitor.getByRole("button", { name: "Send message" }).click();
    await expect(visitor.getByText("Thank you! We'll get back to you soon.")).toBeVisible();
    await evidence(visitor, testInfo, "TC-CONTACT-02-sent", { fullPage: true });

    // It is stored, unread.
    const { data } = await adminDb().from("contact_messages").select("is_read, name").eq("email", email).single();
    expect(data).toEqual({ is_read: false, name: "Contact Tester" });

    // And the studio sees it in the inbox.
    const desk = await browser.newPage();
    await signIn(desk, admin.email, admin.password);
    await desk.goto("/admin/messages");
    await expect(desk.getByText(message)).toBeVisible();
    await expect(desk.getByText("Contact Tester")).toBeVisible();
    await evidence(desk, testInfo, "TC-CONTACT-02-admin-inbox");
  } finally {
    await deleteContactMessages(email);
    await deleteAccount(admin.id);
  }
});
