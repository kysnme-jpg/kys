import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;
  const body = await req.json();

  const existing = await db.sipShopEvent.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, any> = {};
  if (body.hostName !== undefined && String(body.hostName).trim()) data.hostName = String(body.hostName).trim();
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.guests !== undefined) data.guests = Math.max(0, Number(body.guests) || 0);
  if (body.eventDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(body.eventDate)) {
    data.eventDate = parseKey(body.eventDate);
    // If the date moved, allow the reminder to fire again for the new date.
    if (+data.eventDate !== +existing.eventDate) data.reminderSentAt = null;
  }
  if (body.status !== undefined && ["SCHEDULED", "COMPLETED", "CANCELLED"].includes(body.status)) data.status = body.status;

  await db.sipShopEvent.update({ where: { id }, data });
  return NextResponse.json({ updated: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const existing = await db.sipShopEvent.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.sipShopEvent.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
