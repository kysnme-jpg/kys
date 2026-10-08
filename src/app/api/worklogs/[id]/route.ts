import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;
  const body = await req.json();

  const existing = await db.workLog.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, any> = {};
  if (body.employeeName !== undefined && String(body.employeeName).trim()) data.employeeName = String(body.employeeName).trim();
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.note !== undefined) data.note = body.note || null;
  if (body.date !== undefined && body.date) data.date = new Date(body.date);
  if (body.hours !== undefined) data.hours = Math.max(0, Number(body.hours) || 0);
  if (body.payout !== undefined) data.payout = Math.max(0, Number(body.payout) || 0);

  await db.workLog.update({ where: { id }, data });
  return NextResponse.json({ updated: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const existing = await db.workLog.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.workLog.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
