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

  const data: Record<string, any> = {};
  for (const k of ["title", "description", "brand", "size", "color", "condition", "barcode"] as const) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.sku !== undefined && String(body.sku).trim()) data.sku = String(body.sku).trim();
  if (body.price !== undefined) data.price = Math.max(0, Number(body.price) || 0);
  if (body.splitPercent !== undefined) data.splitPercent = Math.max(0, Math.min(100, Number(body.splitPercent) || 0));
  if (body.status !== undefined) data.status = body.status;
  if (body.consignorId !== undefined) data.consignorId = body.consignorId || null;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  if (body.listedOnline !== undefined) data.listedOnline = !!body.listedOnline;
  if (body.featuredOnline !== undefined) data.featuredOnline = !!body.featuredOnline;

  try {
    const item = await db.item.updateMany({ where: { id, storeId }, data });
    if (item.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ updated: true });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That SKU is already in use. Choose a different one." }, { status: 409 });
    }
    throw err;
  }
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
