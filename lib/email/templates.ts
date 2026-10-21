/**
 * Email content. Each builder returns subject, HTML and plain text.
 *
 * Everything a customer or visitor typed (names, notes, messages) is escaped
 * before it goes anywhere near HTML. The legacy system built its emails and
 * its admin tables with string concatenation and innerHTML, which is how it
 * ended up with stored XSS.
 *
 * Styles are inline: most mail clients drop <style> blocks.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

const BURGUNDY = "#662d38";
const SAND = "#f5f1ee";
const INK = "#2b2523";
const MUTED = "#7a6f6b";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain text to HTML paragraphs, escaped, keeping the writer's line breaks. */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function button(href: string, label: string): string {
  return (
    `<p style="margin:24px 0"><a href="${escapeHtml(href)}" ` +
    `style="display:inline-block;background:${BURGUNDY};color:#ffffff;text-decoration:none;` +
    `padding:12px 22px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`
  );
}

function layout(body: string, footer = ""): string {
  return (
    `<!doctype html><html><body style="margin:0;padding:0;background:${SAND}">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:Helvetica,Arial,sans-serif;color:${INK};font-size:15px">` +
    `<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;font-weight:600;color:${BURGUNDY}">J&amp;R Studio</p>` +
    `<div style="background:#ffffff;border-radius:12px;padding:28px 24px">${body}</div>` +
    `<p style="margin:20px 4px 0;font-size:12px;line-height:1.6;color:${MUTED}">J&amp;R Studio · Nasugbu, Batangas${footer}</p>` +
    `</div></body></html>`
  );
}

function detailRows(rows: Array<[string, string]>): string {
  return (
    `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 4px">` +
    rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 0;color:${MUTED};font-size:13px;width:38%">${escapeHtml(label)}</td>` +
          `<td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
      )
      .join("") +
    `</table>`
  );
}

function detailText(rows: Array<[string, string]>): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export type BookingEmailKind = "approved" | "declined" | "cancelled" | "rescheduled";

const BOOKING_COPY: Record<BookingEmailKind, { subject: string; lead: string }> = {
  approved: {
    subject: "Your session is confirmed",
    lead: "Good news: the studio has confirmed your session. We look forward to seeing you.",
  },
  declined: {
    subject: "About your booking request",
    lead: "We're sorry, the studio can't take this booking request.",
  },
  cancelled: {
    subject: "Your session has been cancelled",
    lead: "The studio has cancelled this session.",
  },
  rescheduled: {
    subject: "Your session has a new time",
    lead: "The studio has moved your session to a new time.",
  },
};

export function bookingUpdateEmail(input: {
  kind: BookingEmailKind;
  name: string;
  reference: string;
  packageName: string;
  when: string;
  note?: string | null;
  /** Only customers with an account can open it; walk-ins get no button. */
  link?: string | null;
}): RenderedEmail {
  const copy = BOOKING_COPY[input.kind];
  const rows: Array<[string, string]> = [
    ["Booking", input.reference],
    ["Session", input.packageName],
    ["When", input.when],
  ];
  const note = input.note?.trim();

  const html = layout(
    `<p style="margin:0 0 16px">Hi ${escapeHtml(input.name)},</p>` +
      `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(copy.lead)}</p>` +
      detailRows(rows) +
      (note
        ? `<p style="margin:16px 0 0;color:${MUTED};font-size:13px">Note from the studio</p>${textToHtml(note)}`
        : "") +
      (input.link ? button(input.link, "View your booking") : "") +
      `<p style="margin:16px 0 0;line-height:1.6;color:${MUTED};font-size:13px">Questions? Just reply to this email.</p>`,
  );

  const text = [
    `Hi ${input.name},`,
    "",
    copy.lead,
    "",
    detailText(rows),
    note ? `\nNote from the studio:\n${note}` : "",
    input.link ? `\nView your booking: ${input.link}` : "",
    "",
    "Questions? Just reply to this email.",
    "J&R Studio · Nasugbu, Batangas",
  ].join("\n");

  return { subject: `${copy.subject} (${input.reference})`, html, text };
}

/** To the studio inbox when a customer requests a session online. */
export function newRequestEmail(input: {
  customerName: string;
  reference: string;
  packageName: string;
  when: string;
  notes?: string | null;
  link: string;
}): RenderedEmail {
  const rows: Array<[string, string]> = [
    ["Customer", input.customerName],
    ["Session", input.packageName],
    ["When", input.when],
  ];
  const notes = input.notes?.trim();

  return {
    subject: `New booking request ${input.reference}`,
    html: layout(
      `<p style="margin:0 0 16px;line-height:1.6">A new booking request is waiting for approval.</p>` +
        detailRows(rows) +
        (notes ? `<p style="margin:16px 0 0;color:${MUTED};font-size:13px">Customer's note</p>${textToHtml(notes)}` : "") +
        button(input.link, "Review the request"),
    ),
    text: [
      "A new booking request is waiting for approval.",
      "",
      detailText(rows),
      notes ? `\nCustomer's note:\n${notes}` : "",
      "",
      `Review it: ${input.link}`,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------
export function contactNotificationEmail(input: {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  link: string;
}): RenderedEmail {
  const rows: Array<[string, string]> = [
    ["From", input.name],
    ["Email", input.email],
    ...(input.phone ? [["Mobile", input.phone] as [string, string]] : []),
  ];

  return {
    subject: `New message from ${input.name}`,
    html: layout(
      `<p style="margin:0 0 12px;line-height:1.6">Someone wrote in through the website.</p>` +
        detailRows(rows) +
        `<div style="margin:16px 0 0;padding:16px;background:${SAND};border-radius:8px">${textToHtml(input.message)}</div>` +
        button(input.link, "Open the inbox"),
    ),
    text: [
      "Someone wrote in through the website.",
      "",
      detailText(rows),
      "",
      input.message,
      "",
      `Open the inbox: ${input.link}`,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Staff logins
// ---------------------------------------------------------------------------
export function staffInviteEmail(input: {
  name: string;
  role: "admin" | "staff";
  link: string;
}): RenderedEmail {
  const access = input.role === "admin" ? "an admin" : "a staff";

  return {
    subject: "Your J&R Studio login",
    html: layout(
      `<p style="margin:0 0 16px">Hi ${escapeHtml(input.name)},</p>` +
        `<p style="margin:0 0 16px;line-height:1.6">You've been given ${access} login for the J&amp;R Studio back office. ` +
        `Choose a password to get started.</p>` +
        button(input.link, "Set your password") +
        `<p style="margin:0;line-height:1.6;color:${MUTED};font-size:13px">The link works once, for one hour. ` +
        `If it has expired, ask the studio to send a new one.</p>`,
    ),
    text: [
      `Hi ${input.name},`,
      "",
      `You've been given ${access} login for the J&R Studio back office. Choose a password to get started:`,
      input.link,
      "",
      "The link works once, for one hour. If it has expired, ask the studio to send a new one.",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export function feedbackRequestEmail(input: {
  firstName: string;
  packageName: string;
  sessionDate: string;
  link: string;
}): RenderedEmail {
  return {
    subject: "How was your session at J&R Studio?",
    html: layout(
      `<p style="margin:0 0 16px">Hi ${escapeHtml(input.firstName)},</p>` +
        `<p style="margin:0 0 16px;line-height:1.6">Thank you for choosing us for your ${escapeHtml(input.packageName)} ` +
        `session on ${escapeHtml(input.sessionDate)}. Would you tell us how it went? It takes a minute, and it helps ` +
        `other families and couples find us.</p>` +
        button(input.link, "Leave a review") +
        `<p style="margin:0;line-height:1.6;color:${MUTED};font-size:13px">No account needed. The link works for 60 days.</p>`,
    ),
    text: [
      `Hi ${input.firstName},`,
      "",
      `Thank you for choosing us for your ${input.packageName} session on ${input.sessionDate}. ` +
        "Would you tell us how it went? It takes a minute, and it helps other families and couples find us.",
      "",
      `Leave a review: ${input.link}`,
      "",
      "No account needed. The link works for 60 days.",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Bulk email
// ---------------------------------------------------------------------------
export function campaignEmail(input: {
  subject: string;
  body: string;
  name: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  // A greeting line written as "Hi {name}," is personalised per recipient.
  const body = input.body.replace(/\{name\}/g, input.name);

  return {
    subject: input.subject,
    html: layout(
      textToHtml(body),
      ` · You're receiving this because you agreed to studio news and offers. ` +
        `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${MUTED}">Unsubscribe</a>`,
    ),
    text: [
      body.trim(),
      "",
      "—",
      "You're receiving this because you agreed to studio news and offers.",
      `Unsubscribe: ${input.unsubscribeUrl}`,
    ].join("\n"),
  };
}
