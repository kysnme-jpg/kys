import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
  for (const k of ["totalPrice", "serviceFee", "deposit", "payment2", "payment3", "finalPayment", "amountPaid"] as const) {
    if (body[k] !== undefined) data[k] = Math.max(0, Number(body[k]) || 0);
  }
  if (body.status !== undefined && ["ACTIVE", "COMPLETED", "CANCELLED"].includes(body.status)) data.status = body.status;

  // Record an additional payment (adds to amountPaid; completes when fully paid).
  if (body.addPayment !== undefined) {
    const add = Math.max(0, Number(body.addPayment) || 0);
    const newPaid = existing.amountPaid + add;
    data.amountPaid = newPaid;
    if (newPaid >= existing.totalPrice) data.status = "COMPLETED";
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
