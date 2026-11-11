import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { resolveAudienceRecipients } from "@/lib/audience-recipients";
import { validateAudience, describeAudience, type AudienceScope } from "@/lib/posts";
import { sendBroadcast, sendBroadcastTest } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Send an audience email (§5). CONTENT_ADMIN only. Reuses the same audience
 * model as the content feed, so targeting is identical across both.
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;
  if (g.actor.class !== "INTERNAL") return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const actor = g.actor;

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const isTest = !!body.test;

  if (!subject) return NextResponse.json({ error: "A subject is required." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const target = { scope: body.audienceScope as AudienceScope, role: body.audienceRole, tag: body.audienceTag };
  const audErr = validateAudience(target);
  if (audErr) return NextResponse.json({ error: audErr }, { status: 400 });

  const store = await db.store.findUnique({ where: { id: actor.storeId }, select: { name: true } });
  const storeName = store?.name || "Our Store";

  // Test send → only to the logged-in staffer's own email.
  if (isTest) {
    const me = await db.user.findUnique({ where: { id: actor.userId }, select: { email: true } });
    if (!me?.email) return NextResponse.json({ error: "Your account has no email address to send a test to." }, { status: 400 });
    const res = await sendBroadcastTest({ to: me.email, subject, message, storeName });
    if (!res.ok) return NextResponse.json({ error: res.error || "Test send failed." }, { status: 502 });
    return NextResponse.json({ test: true, to: me.email });
  }

  // Real send.
  const recipients = await resolveAudienceRecipients(actor.storeId, target);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "That audience has no one with an email address." }, { status: 400 });
  }

  const result = await sendBroadcast({ recipients, subject, message, storeName });
  if (result.skipped) {
    return NextResponse.json({ error: "Email isn't configured on the server (RESEND_API_KEY missing)." }, { status: 502 });
  }

  // Log ONE summary row so the email log stays readable.
  await db.emailLog.create({
    data: {
      storeId: actor.storeId,
      to: `${result.sent} recipient${result.sent === 1 ? "" : "s"} — ${describeAudience(target)}`,
      type: "BROADCAST",
      subject,
      status: result.failed > 0 ? (result.sent > 0 ? "SENT" : "FAILED") : "SENT",
    },
  }).catch(() => {});

  return NextResponse.json({ sent: result.sent, failed: result.failed, total: recipients.length });
}
