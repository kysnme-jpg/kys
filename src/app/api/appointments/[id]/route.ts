import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Staff: cancel (delete) an appointment.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const existing = await db.consignAppointment.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.consignAppointment.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
