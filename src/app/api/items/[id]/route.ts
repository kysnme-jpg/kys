import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const item = await db.item.findFirst({
    where: { id, storeId },
    include: {
      consignor: { select: { id: true, firstName: true, lastName: true, splitPercent: true } },
      category: { select: { id: true, name: true } },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const storeId = (session.user as any).storeId;
  const body = await req.json();

  const item = await db.item.updateMany({
    where: { id, storeId },
    data: body,
  });

  if (item.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const storeId = (session.user as any).storeId;

  // Only allow deletion of non-sold items
  const item = await db.item.findFirst({ where: { id, storeId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status === "SOLD") return NextResponse.json({ error: "Cannot delete a sold item" }, { status: 400 });

  await db.item.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
