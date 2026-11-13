import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveName } from "@/lib/names";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;
  const body = await req.json();

  const existing = await db.layaway.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, any> = {};
  for (const k of ["buyerName", "address", "cityStateZip", "phone", "email", "items"] as const) {
    if (body[k] !== undefined) data[k] = body[k] || (k === "buyerName" || k === "items" ? existing[k] : null);
  }

  // Name: separate first/last fields (or a single full name from older callers).
  // The full name is always kept in sync for lists and emails.
  if (body.firstName !== undefined || body.lastName !== undefined) {
    const name = resolveName({ firstName: body.firstName ?? existing.firstName, lastName: body.lastName ?? existing.lastName });
    if (!name.firstName) return NextResponse.json({ error: "First name is required" }, { status: 400 });
    data.firstName = name.firstName; data.lastName = name.lastName || null; data.buyerName = name.full;
  } else if (typeof body.buyerName === "string" && body.buyerName.trim()) {
    const name = resolveName({ full: body.buyerName });
    data.firstName = name.firstName; data.lastName = name.lastName || null; data.buyerName = name.full;
  }
  for (const k of ["totalPrice", "serviceFee", "deposit", "payment2", "payment3", "finalPayment"] as const) {
    if (body[k] !== undefined) data[k] = Math.max(0, Number(body[k]) || 0);
  }
  if (body.status !== undefined && ["ACTIVE", "COMPLETED", "CANCELLED"].includes(body.status)) data.status = body.status;

  // Amount paid: take the corrected running total (amountPaid) as the source of
  // truth, then add any new payment on top. This replaces rather than re-adds,
  // so the total is always exactly what staff see — never double-counted.
  if (body.amountPaid !== undefined || body.addPayment !== undefined) {
    const base = body.amountPaid !== undefined ? Math.max(0, Number(body.amountPaid) || 0) : existing.amountPaid;
    const add = body.addPayment !== undefined ? Math.max(0, Number(body.addPayment) || 0) : 0;
    const paid = base + add;
    data.amountPaid = paid;
    const total = data.totalPrice ?? existing.totalPrice;
    if (total > 0 && paid >= total) data.status = "COMPLETED";
  }

  await db.layaway.update({ where: { id }, data });
  return NextResponse.json({ updated: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const existing = await db.layaway.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.layaway.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
