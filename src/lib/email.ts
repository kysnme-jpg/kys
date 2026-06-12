import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.EMAIL_FROM || "ConsignPro <noreply@consignpro.app>";

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
