import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendPortalAccessEmail } from "@/lib/email";
import { logEmail } from "@/lib/email-log";
import { getBaseUrl } from "@/lib/base-url";

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// (Re)send portal access: set a NEW temp password, enable the portal, and force
// the consignor to choose their own password on next login. Emails it when an
// address is on file; always returns the temp password so staff can share it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const consignor = await db.consignor.findFirst({ where: { id, storeId } });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const temp = tempPassword();
  await db.consignor.update({
    where: { id },
    data: { portalPassword: await bcrypt.hash(temp, 10), portalEnabled: true, portalMustReset: true },
  });

  const to = (consignor.email || "").trim();
  let emailed = false;
  if (to) {
    try {
      const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
      const portalUrl = `${getBaseUrl(req)}/portal/login`;
      const res = await sendPortalAccessEmail({
        to,
        consignorName: consignor.firstName,
        storeName: store?.name || "Classic Consigns by KYS",
        portalUrl,
        loginEmail: to,
        tempPassword: temp,
      });
      emailed = res.sent;
      await logEmail({ storeId, consignorId: id, to, type: "OTHER", subject: "Portal access", status: emailed ? "SENT" : "FAILED" });
    } catch {
      emailed = false;
    }
  }

  // temp password returned so staff can relay it if email isn't configured/sent
  return NextResponse.json({ ok: true, emailed, to: to || null, tempPassword: temp });
}
