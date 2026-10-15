import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.EMAIL_FROM || "Classic Consigns by KYS <kimberly@classicconsigns.com>";

// ─── Email templates ──────────────────────────────────────────────────────────

function baseHtml(title: string, body: string, storeName: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:#4f46e5;padding:24px 32px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700">${storeName}</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827">${title}</h1>
          ${body}
          <p style="margin:32px 0 0;font-size:12px;color:#9ca3af">
            This email was sent by ${storeName} via ConsignPro.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Notify the store that a new appointment was just booked.
export async function sendBookingNotification(opts: {
  to: string;
  storeName: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  dateLabel: string;
  timeLabel: string;
}) {
  const r = getResend();
  if (!r) return;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">${label}</td><td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${value}</td></tr>`;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">You have a new consignment appointment booking:</p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
      ${row("Date", opts.dateLabel)}
      ${row("Time", opts.timeLabel)}
      ${row("Name", opts.name)}
      ${opts.phone ? row("Phone", opts.phone) : ""}
      ${opts.email ? row("Email", opts.email) : ""}
      ${opts.note ? row("Note", opts.note) : ""}
    </table>
    <p style="color:#374151;font-size:13px">View and manage it under People → Appointments.</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `🗓️ New appointment — ${opts.name}, ${opts.dateLabel}`,
    html: baseHtml("New Appointment Booked", body, opts.storeName),
  });
}

// ─── Layaway ─────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export async function sendLayawayAgreementEmail(opts: {
  to: string;
  buyerName: string;
  storeName: string;
  items: string;
  totalPrice: number;
  serviceFee: number;
  deposit: number;
  payment2: number;
  payment3: number;
  finalPayment: number;
  dueDates: { p2: string; p3: string; final: string };
}) {
  const r = getResend();
  if (!r) return;

  const scheduleRow = (label: string, amount: number, due: string) =>
    `<tr><td style="padding:7px 0;color:#374151;font-size:14px">${label}</td><td style="padding:7px 0;color:#6b7280;font-size:13px;text-align:center">${due}</td><td style="padding:7px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${fmtMoney(amount)}</td></tr>`;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.buyerName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">Thank you! Here are the details of your layaway with ${opts.storeName}.</p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Item(s)</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.items.replace(/\n/g, "<br>")}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Total Price</td><td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${fmtMoney(opts.totalPrice)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Layaway Fee (non-refundable)</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${fmtMoney(opts.serviceFee)}</td></tr>
    </table>
    <p style="color:#111827;font-size:15px;font-weight:700;margin:16px 0 6px">Payment Schedule</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:16px">
      <tr style="border-bottom:1px solid #e5e7eb"><td style="padding:4px 0;color:#9ca3af;font-size:12px">Payment</td><td style="padding:4px 0;color:#9ca3af;font-size:12px;text-align:center">Due</td><td style="padding:4px 0;color:#9ca3af;font-size:12px;text-align:right">Amount</td></tr>
      ${scheduleRow("Deposit (today)", opts.deposit, "Today")}
      ${scheduleRow("Payment 2", opts.payment2, opts.dueDates.p2)}
      ${scheduleRow("Payment 3", opts.payment3, opts.dueDates.p3)}
      ${scheduleRow("Final Payment", opts.finalPayment, opts.dueDates.final)}
    </table>
    <p style="color:#374151;font-size:13px;line-height:1.6">Layaway period is 45 days. Items must be picked up within the 45-day period after full payment. Questions? Just reply to this email or call us.</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your layaway details — ${opts.storeName}`,
    html: baseHtml("Your Layaway Agreement", body, opts.storeName),
  });
}

export async function sendLayawayReminderEmail(opts: {
  to: string;
  buyerName: string;
  storeName: string;
  which: string; // "Payment 2 (due in 15 days)" etc.
  amountDue: number;
  balanceRemaining: number;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.buyerName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">This is a friendly reminder about your layaway with ${opts.storeName}.</p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Now due</td><td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${opts.which}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Amount</td><td style="padding:6px 0;color:#b4532a;font-weight:700;font-size:18px;text-align:right">${fmtMoney(opts.amountDue)}</td></tr>
      <tr style="border-top:1px solid #d1d5db"><td style="padding:10px 0 0;color:#6b7280;font-size:14px">Balance remaining</td><td style="padding:10px 0 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${fmtMoney(opts.balanceRemaining)}</td></tr>
    </table>
    <p style="color:#374151;font-size:13px;line-height:1.6">Please stop by or call to make your payment. Thank you!</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Layaway payment reminder — ${opts.storeName}`,
    html: baseHtml("Layaway Payment Reminder", body, opts.storeName),
  });
}

// ─── Borrowed garment ────────────────────────────────────────────────────────

export async function sendBorrowedAgreementEmail(opts: {
  to: string;
  borrowerName: string;
  storeName: string;
  items: string;
  dateBorrowed: string;
  returnDate?: string | null;
  dryCleaning?: string | null;
}) {
  const r = getResend();
  if (!r) return;

  const dryMap: Record<string, string> = {
    BORROWER: "Borrower IS responsible for dry cleaning costs.",
    NOT_BORROWER: "Borrower is NOT responsible for dry cleaning costs.",
    UPON_RETURN: "Dry cleaning will be determined upon return inspection.",
  };

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.borrowerName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">Thank you for borrowing from ${opts.storeName}. Here are the item(s) and terms.</p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Date Borrowed</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.dateBorrowed}</td></tr>
      ${opts.returnDate ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Return Date</td><td style="padding:6px 0;color:#b4532a;font-weight:700;font-size:14px;text-align:right">${opts.returnDate}</td></tr>` : ""}
    </table>
    <p style="color:#111827;font-size:15px;font-weight:700;margin:16px 0 6px">Item(s) Borrowed</p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap">${opts.items.replace(/\n/g, "<br>")}</div>
    ${opts.dryCleaning && dryMap[opts.dryCleaning] ? `<p style="color:#374151;font-size:14px;margin-top:14px"><strong>Dry cleaning:</strong> ${dryMap[opts.dryCleaning]}</p>` : ""}
    <p style="color:#374151;font-size:13px;line-height:1.6;margin-top:14px">
      You accept full responsibility for all items while in your possession and agree to return them in the same condition. You are financially responsible for any loss, theft, stains, odors, tears, alterations, or damage, up to the full replacement value. Please return items by the return date above.
    </p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your borrowed garment agreement — ${opts.storeName}`,
    html: baseHtml("Borrowed Garment Agreement", body, opts.storeName),
  });
}

export async function sendBorrowedReturnReminderEmail(opts: {
  to: string;
  borrowerName: string;
  storeName: string;
  items: string;
  returnDate: string;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.borrowerName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">This is a reminder that your borrowed item(s) from ${opts.storeName} are due back on <strong>${opts.returnDate}</strong>.</p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:14px 0">${opts.items.replace(/\n/g, "<br>")}</div>
    <p style="color:#374151;font-size:13px;line-height:1.6">Please return them in the same condition received. Thank you!</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Reminder: items due back ${opts.returnDate} — ${opts.storeName}`,
    html: baseHtml("Return Reminder", body, opts.storeName),
  });
}

// ─── Sip & Shop ──────────────────────────────────────────────────────────────

const SIP_TIME = "7:00 PM – 10:00 PM";

function sipPerksBlock() {
  return `
    <div style="background:#1a1a1a;border-radius:10px;padding:18px 20px;margin:18px 0;color:#fff">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#e9a0b4">Your Sip &amp; Shop includes</p>
      <ul style="margin:0;padding-left:18px;color:#f3f3f3;font-size:14px;line-height:1.8">
        <li>Two types of wine 🍷</li>
        <li>A delicious charcuterie board 🧀</li>
        <li>You + up to 15 guests — a fun, fashionable experience made just for you</li>
        <li>Earn <strong>15% of your sales in store credit</strong></li>
      </ul>
    </div>`;
}

export async function sendSipShopConfirmationEmail(opts: {
  to: string;
  hostName: string;
  storeName: string;
  dateLabel: string;
  guests: number;
  address?: string | null;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.hostName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">You're all set to host a <strong>Sip &amp; Shop</strong> at ${opts.storeName}! Shop. Sip. Sustain. Repeat. 💕</p>
    <table width="100%" style="background:#f6eef0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Date</td><td style="padding:6px 0;color:#111827;font-weight:700;font-size:15px;text-align:right">${opts.dateLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Time</td><td style="padding:6px 0;color:#111827;font-weight:700;font-size:15px;text-align:right">${SIP_TIME}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Guests</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.guests} ${opts.guests === 1 ? "guest" : "guests"}</td></tr>
      ${opts.address ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Location</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.address}</td></tr>` : ""}
    </table>
    ${sipPerksBlock()}
    <p style="color:#374151;font-size:14px;line-height:1.6">We can't wait to host you and your guests. If you need to change your date or guest count, just reply to this email or give us a call.</p>
    <p style="color:#b4532a;font-size:14px;font-weight:600">Be fabulous. Be sustainable. Be you. 🤍</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `🍷 Your Sip & Shop is booked — ${opts.dateLabel}`,
    html: baseHtml("Your Sip & Shop is Confirmed", body, opts.storeName),
  });
}

export async function sendSipShopReminderEmail(opts: {
  to: string;
  hostName: string;
  storeName: string;
  dateLabel: string;
  guests: number;
  address?: string | null;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.hostName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">Your <strong>Sip &amp; Shop</strong> at ${opts.storeName} is coming up soon — we can't wait! 🥂</p>
    <table width="100%" style="background:#f6eef0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Date</td><td style="padding:6px 0;color:#111827;font-weight:700;font-size:15px;text-align:right">${opts.dateLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Time</td><td style="padding:6px 0;color:#111827;font-weight:700;font-size:15px;text-align:right">${SIP_TIME}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Guests</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.guests} ${opts.guests === 1 ? "guest" : "guests"}</td></tr>
      ${opts.address ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Location</td><td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.address}</td></tr>` : ""}
    </table>
    <p style="color:#374151;font-size:14px;line-height:1.6">Bring your favorite people and get ready to shop sustainably. Remember, you'll earn <strong>15% of your sales in store credit</strong>!</p>
    <p style="color:#b4532a;font-size:14px;font-weight:600">See you soon! 🤍</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `🥂 Reminder: your Sip & Shop is ${opts.dateLabel}`,
    html: baseHtml("Your Sip & Shop is Coming Up", body, opts.storeName),
  });
}

export async function sendSipShopStoreNotification(opts: {
  to: string;
  storeName: string;
  hostName: string;
  dateLabel: string;
  guests: number;
  email?: string | null;
  phone?: string | null;
}) {
  const r = getResend();
  if (!r) return;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">${label}</td><td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${value}</td></tr>`;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">A customer just requested a Sip &amp; Shop:</p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
      ${row("Date", opts.dateLabel)}
      ${row("Time", "7:00 PM – 10:00 PM")}
      ${row("Host", opts.hostName)}
      ${row("Guests", String(opts.guests))}
      ${opts.phone ? row("Phone", opts.phone) : ""}
      ${opts.email ? row("Email", opts.email) : ""}
    </table>
    <p style="color:#374151;font-size:13px">View and manage it under People → Sip &amp; Shop.</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `🍷 New Sip & Shop request — ${opts.hostName}, ${opts.dateLabel}`,
    html: baseHtml("New Sip & Shop Request", body, opts.storeName),
  });
}

// ─── Diagnostics ───────────────────────────────────────────────────────────────

// Sends a test email and RETURNS the outcome (does not swallow errors), so the
// owner can see exactly why email isn't working.
export async function sendTestEmail(to: string, storeName: string): Promise<{ ok: boolean; id?: string; error?: string; from: string; hasKey: boolean }> {
  const hasKey = !!process.env.RESEND_API_KEY;
  if (!hasKey) return { ok: false, error: "RESEND_API_KEY is not set on the server.", from: FROM, hasKey };
  const r = getResend();
  if (!r) return { ok: false, error: "Resend client could not be created.", from: FROM, hasKey };

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">This is a test email from ${storeName}.</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">If you're reading this, your email setup is working. 🎉</p>`;
  try {
    const { data, error } = await r.emails.send({
      from: FROM,
      to,
      subject: `Test email — ${storeName}`,
      html: baseHtml("Email is working", body, storeName),
    });
    if (error) return { ok: false, error: `${(error as any).name || "Error"}: ${(error as any).message || JSON.stringify(error)}`, from: FROM, hasKey };
    return { ok: true, id: data?.id, from: FROM, hasKey };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), from: FROM, hasKey };
  }
}

// ─── Exported send functions ──────────────────────────────────────────────────

export async function sendItemSoldEmail(opts: {
  to: string;
  consignorName: string;
  itemTitle: string;
  salePrice: number;
  consignorShare: number;
  newBalance: number;
  storeName: string;
}) {
  const r = getResend();
  if (!r) return;

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Hi ${opts.consignorName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Great news — one of your items just sold!
    </p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Item</td>
        <td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${opts.itemTitle}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Sale Price</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${fmt(opts.salePrice)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Your Earnings</td>
        <td style="padding:6px 0;color:#059669;font-weight:700;font-size:16px;text-align:right">${fmt(opts.consignorShare)}</td>
      </tr>
      <tr style="border-top:1px solid #d1d5db">
        <td style="padding:10px 0 0;color:#6b7280;font-size:14px">New Balance</td>
        <td style="padding:10px 0 0;color:#4f46e5;font-weight:700;font-size:16px;text-align:right">${fmt(opts.newBalance)}</td>
      </tr>
    </table>
    <p style="color:#374151;font-size:14px">
      Contact the store to request your payout, or log in to your Consignor Portal to view all your items and earnings.
    </p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `✅ Your item sold — ${opts.itemTitle}`,
    html: baseHtml("Your Item Sold!", body, opts.storeName),
  });
}

export async function sendPayoutEmail(opts: {
  to: string;
  consignorName: string;
  amount: number;
  method: string;
  checkNumber?: string;
  storeName: string;
}) {
  const r = getResend();
  if (!r) return;

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const methodLabel = opts.method === "CHECK"
    ? `Check${opts.checkNumber ? ` #${opts.checkNumber}` : ""}`
    : opts.method === "ACH" ? "ACH Direct Deposit (1-3 business days)"
    : "Cash";

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.consignorName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">Your payout has been processed!</p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Amount</td>
        <td style="padding:6px 0;color:#059669;font-weight:700;font-size:20px;text-align:right">${fmt(opts.amount)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Method</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${methodLabel}</td>
      </tr>
    </table>
    <p style="color:#374151;font-size:14px">Thank you for consigning with ${opts.storeName}!</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `💸 Payout of ${fmt(opts.amount)} sent — ${opts.storeName}`,
    html: baseHtml("Payout Sent!", body, opts.storeName),
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  consignorName: string;
  storeName: string;
  splitPercent: number;
  portalUrl: string;
  tempPassword?: string;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.consignorName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Welcome to ${opts.storeName}! Your consignor account has been set up.
    </p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Your Split</td>
        <td style="padding:6px 0;color:#4f46e5;font-weight:700;font-size:16px;text-align:right">${opts.splitPercent}%</td>
      </tr>
      ${opts.tempPassword ? `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Portal Password</td>
        <td style="padding:6px 0;color:#111827;font-family:monospace;font-size:14px;text-align:right">${opts.tempPassword}</td>
      </tr>` : ""}
    </table>
    <p style="margin:20px 0">
      <a href="${opts.portalUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
        Access Your Portal →
      </a>
    </p>
    <p style="color:#374151;font-size:14px">
      From your portal you can track your items, view your balance, and see your earnings history.
    </p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Welcome to ${opts.storeName} — Your consignor account is ready`,
    html: baseHtml(`Welcome, ${opts.consignorName}!`, body, opts.storeName),
  });
}

export async function sendAppointmentEmail(opts: {
  to: string;
  name: string;
  storeName: string;
  dateLabel: string;
  timeLabel: string;
  address?: string | null;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.name},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Your consignment appointment with ${opts.storeName} is confirmed. We look forward to seeing you!
    </p>
    <table width="100%" style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Date</td>
        <td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${opts.dateLabel}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Time</td>
        <td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;text-align:right">${opts.timeLabel}</td>
      </tr>
      ${opts.address ? `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Location</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;text-align:right">${opts.address}</td>
      </tr>` : ""}
    </table>
    <p style="color:#374151;font-size:14px;line-height:1.6">
      <strong>A few reminders for your visit:</strong>
    </p>
    <ul style="color:#374151;font-size:14px;line-height:1.6;padding-left:20px;margin:8px 0">
      <li>First-time consigning: please bring <strong>no more than 10 items</strong>.</li>
      <li>Shoes &amp; jewelry are not counted in the 10 (please don’t bring tons of jewelry).</li>
      <li>Each appointment is up to 40 minutes.</li>
    </ul>
    <p style="color:#374151;font-size:14px">If you need to change or cancel, just give us a call or reply to this email.</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `📅 Appointment confirmed — ${opts.dateLabel}, ${opts.storeName}`,
    html: baseHtml("Your Appointment is Confirmed", body, opts.storeName),
  });
}

export async function sendContractEmail(opts: {
  to: string;
  consignorName: string;
  storeName: string;
  contractId: string;
  signUrl: string;
}) {
  const r = getResend();
  if (!r) return;

  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6">Hi ${opts.consignorName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6">
      ${opts.storeName} has sent you a consignment agreement to review and sign.
    </p>
    <p style="margin:24px 0">
      <a href="${opts.signUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
        Review &amp; Sign Agreement →
      </a>
    </p>
    <p style="color:#9ca3af;font-size:13px">This link is unique to you. Do not share it.</p>`;

  await r.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Please sign your consignment agreement — ${opts.storeName}`,
    html: baseHtml("Consignment Agreement Ready to Sign", body, opts.storeName),
  });
}
