import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcConsignorCredit } from "@/lib/utils";

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
  if (body.costPrice !== undefined) data.costPrice = body.costPrice === "" || body.costPrice === null ? null : Math.max(0, Number(body.costPrice) || 0);
  if (body.location !== undefined) data.location = body.location || null;
  if (body.splitPercent !== undefined) data.splitPercent = Math.max(0, Math.min(100, Number(body.splitPercent) || 0));
  if (body.status !== undefined) data.status = body.status;
  if (body.consignorId !== undefined) data.consignorId = body.consignorId || null;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  if (body.listedOnline !== undefined) data.listedOnline = !!body.listedOnline;
  if (body.featuredOnline !== undefined) data.featuredOnline = !!body.featuredOnline;

  try {
    const existing = await db.item.findFirst({ where: { id, storeId }, include: { consignor: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const resultingStatus = (data.status ?? existing.status) as string;
    const price = (data.price ?? existing.price) as number;
    const split = (data.splitPercent ?? existing.splitPercent ?? existing.consignor?.splitPercent ?? 50) as number;
    const credit = calcConsignorCredit(price, split);

    await db.$transaction(async (tx: any) => {
      const soldAtPatch: any = {};
      if (resultingStatus === "SOLD" && existing.status !== "SOLD") soldAtPatch.soldAt = new Date();
      if (resultingStatus !== "SOLD" && existing.status === "SOLD") soldAtPatch.soldAt = null;

      await tx.item.update({ where: { id }, data: { ...data, ...soldAtPatch } });

      // Keep the consignor's balance in sync when an item is marked sold / un-sold
      // outside of a POS sale. POS sales already credit (they have a SaleItem).
      if (existing.type === "CONSIGNED" && existing.consignorId) {
        const hasPosSale = await tx.saleItem.findFirst({ where: { itemId: id } });
        const manualCredit = await tx.ledgerEntry.findFirst({ where: { itemId: id, type: "SALE_CREDIT" } });

        if (resultingStatus === "SOLD" && !hasPosSale && !manualCredit && credit > 0) {
          await tx.ledgerEntry.create({
            data: { consignorId: existing.consignorId, itemId: id, type: "SALE_CREDIT", amount: credit, note: `Sold: "${existing.title}" — ${split}% split` },
          });
          await tx.consignor.update({ where: { id: existing.consignorId }, data: { balance: { increment: credit } } });
        } else if (resultingStatus !== "SOLD" && manualCredit) {
          await tx.ledgerEntry.delete({ where: { id: manualCredit.id } });
          await tx.consignor.update({ where: { id: existing.consignorId }, data: { balance: { decrement: manualCredit.amount } } });
        }
      }
    });

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
