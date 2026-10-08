#!/usr/bin/env node
/*
 * Send a test email through Resend — useful for confirming your RESEND_API_KEY
 * and EMAIL_FROM are working, and for previewing the appointment confirmation.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx node scripts/send-test-email.mjs you@example.com
 *
 * Optional env:
 *   EMAIL_FROM   Sender (default: "Classic Consigns by KYS <kimberly@classicconsigns.com>").
 *                The domain MUST be verified in Resend, or the send is rejected.
 *
 * Tip: on Railway you can run this from the service shell, where RESEND_API_KEY
 * and EMAIL_FROM are already set:
 *   node scripts/send-test-email.mjs you@example.com
 */

import { Resend } from "resend";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/send-test-email.mjs <recipient-email>");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("Missing RESEND_API_KEY. Run with: RESEND_API_KEY=re_xxx node scripts/send-test-email.mjs " + to);
  process.exit(1);
}

const FROM = process.env.EMAIL_FROM || "Classic Consigns by KYS <kimberly@classicconsigns.com>";
const STORE = "Classic Consigns by KYS";

// Sample appointment details (mirrors the real confirmation email).
const dateLabel = "Saturday, November 1, 2025";
const timeLabel = "12:00 PM – 12:40 PM";
const address = "Baltimore, MD";
const name = "there";

function baseHtml(title, body, storeName) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:#b4532a;padding:24px 32px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700">${storeName}</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827">${title}</h1>
          ${body}
          <p style="margin:32px 0 0;font-size:12px;color:#9ca3af">This is a test email from ${storeName}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const body = `
  <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${name},</p>
  <p style="color:#374151;font-size:15px;line-height:1.6">
    Your consignment appointment with ${STORE} is confirmed. We look forward to seeing you!
  </p>
  <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Date</td><td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${dateLabel}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Time</td><td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${timeLabel}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Location</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${address}</td></tr>
  </table>
  <p style="color:#374151;font-size:14px;line-height:1.6"><strong>A few reminders for your visit:</strong></p>
  <ul style="color:#374151;font-size:14px;line-height:1.6;padding-left:20px;margin:8px 0">
    <li>First-time consigning: please bring <strong>no more than 10 items</strong>.</li>
    <li>Shoes &amp; jewelry are not counted in the 10 (please don’t bring tons of jewelry).</li>
    <li>Each appointment is up to 40 minutes.</li>
  </ul>
  <p style="color:#374151;font-size:14px">If you need to change or cancel, just give us a call or reply to this email.</p>`;

const resend = new Resend(apiKey);

console.log(`Sending test email…\n  From: ${FROM}\n  To:   ${to}`);

try {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `📅 Test — Appointment confirmed, ${STORE}`,
    html: baseHtml("Your Appointment is Confirmed", body, STORE),
  });
  if (error) {
    console.error("\n❌ Resend returned an error:");
    console.error(error);
    if (String(error.message || "").toLowerCase().includes("domain")) {
      console.error("\n→ This usually means the sender domain isn't verified yet in Resend.");
      console.error("  Verify the domain (Resend → Domains) or set EMAIL_FROM to a verified address.");
    }
    process.exit(1);
  }
  console.log("\n✅ Sent! Resend message id:", data?.id);
  console.log("Check the inbox (and spam) for:", to);
} catch (err) {
  console.error("\n❌ Failed to send:", err?.message || err);
  process.exit(1);
}
