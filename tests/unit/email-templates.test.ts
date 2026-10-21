import { describe, expect, it } from "vitest";
import {
  bookingUpdateEmail,
  campaignEmail,
  contactNotificationEmail,
  escapeHtml,
  textToHtml,
} from "@/lib/email/templates";

describe("email templates", () => {
  it("escapes everything a visitor typed", () => {
    const email = contactNotificationEmail({
      name: `<img src=x onerror="alert(1)">`,
      email: "a@example.com",
      message: "<script>steal()</script>\n\nSecond & last",
      link: "https://example.com/admin/messages",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Second &amp; last");
    // The plain-text part is text, so it keeps the original characters.
    expect(email.text).toContain("<script>steal()</script>");
  });

  it("keeps paragraphs and line breaks", () => {
    expect(textToHtml("one\ntwo\n\nthree")).toBe(
      '<p style="margin:0 0 16px;line-height:1.6">one<br>two</p><p style="margin:0 0 16px;line-height:1.6">three</p>',
    );
  });

  it("escapes quotes, so a value cannot break out of an attribute", () => {
    expect(escapeHtml(`" onmouseover="x`)).toBe("&quot; onmouseover=&quot;x");
  });

  it("puts the customer's name into a campaign, escaped, and always adds the unsubscribe link", () => {
    const email = campaignEmail({
      subject: "Holiday slots",
      body: "Hi {name},\n\nWe have openings.",
      name: "<b>Ana</b>",
      unsubscribeUrl: "https://studio.example/unsubscribe?token=abc",
    });
    expect(email.html).toContain("Hi &lt;b&gt;Ana&lt;/b&gt;,");
    expect(email.html).toContain("https://studio.example/unsubscribe?token=abc");
    expect(email.text).toContain("Unsubscribe: https://studio.example/unsubscribe?token=abc");
  });

  it("gives walk-ins (no account) no button to a page they cannot open", () => {
    const base = {
      kind: "approved" as const,
      name: "Ana",
      reference: "JR-00012",
      packageName: "Pro Portraits",
      when: "Oct 28, 2026, 10:00 AM – 11:00 AM",
    };
    expect(bookingUpdateEmail({ ...base, link: null }).html).not.toContain("View your booking");
    expect(bookingUpdateEmail({ ...base, link: "https://x/account/bookings/1" }).html).toContain("View your booking");
    expect(bookingUpdateEmail(base).subject).toBe("Your session is confirmed (JR-00012)");
  });
});
