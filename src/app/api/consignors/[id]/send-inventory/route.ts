import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendConsignorInventoryEmail } from "@/lib/email";
import { logEmail } from "@/lib/email-log";

function tempPassword() {
  // Friendly 8-char password (no ambiguous chars).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const body = await req.json().catch(() => ({}));
  const consignor = await db.consignor.findFirst({
    where: { id, storeId },
    include: { items: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: { title: true, sku: true, size: true, brand: true, price: true } } },
  });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = (body.to || consignor.email || "").trim();
  if (!to) return NextResponse.json({ error: "No email on file for this consignor. Enter one to send to." }, { status: 400 });

  const isTest = !consignor.email || to.toLowerCase() !== consignor.email.toLowerCase();

  const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
  const origin = new URL(req.url).origin;
  const portalUrl = `${origin}/portal/login`;

  // Only when sending to the real consignor: make sure the portal works. Enable
  // it and set a temp password if they don't have one yet (never reset an
  // existing one). Test sends make no changes.
  let tempPw: string | null = null;
  let portalEnabled = consignor.portalEnabled;
  if (!isTest) {
    const updates: any = {};
    if (!consignor.portalEnabled) { updates.portalEnabled = true; portalEnabled = true; }
    if (!consignor.portalPassword) { tempPw = tempPassword(); updates.portalPassword = await bcrypt.hash(tempPw, 10); }
    if (Object.keys(updates).length) await db.consignor.update({ where: { id }, data: updates });
  }

  try {
    await sendConsignorInventoryEmail({
      to,
      consignorName: consignor.firstName,
      storeName: store?.name || "Classic Consigns by KYS",
      splitPercent: consignor.splitPercent,
      items: consignor.items,
      portalUrl,
      loginEmail: consignor.email,
      tempPassword: tempPw,
      isTest,
    });
  } catch (err: any) {
    await logEmail({ storeId, consignorId: id, to, type: "INVENTORY", subject: "Inventory summary", status: "FAILED" });
    return NextResponse.json({ error: err?.message || "Couldn't send the email." }, { status: 502 });
  }

  await logEmail({ storeId, consignorId: id, to, type: "INVENTORY", subject: `Inventory summary (${consignor.items.length} items)`, status: isTest ? "TEST" : "SENT" });

  return NextResponse.json({ sent: true, to, test: isTest, portalEnabled, itemCount: consignor.items.length });
}
