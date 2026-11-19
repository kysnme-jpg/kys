import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { chargeItemFees, MAX_FEE } from "@/lib/item-fees";

export const runtime = "nodejs";

const schema = z.object({
  label: z.string().trim().min(1, "Enter what the charge is for").max(60),
  amount: z.number().positive("Enter an amount").max(MAX_FEE),
});

// GET /api/items/:id/fees — the item's consignor charges.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const item = await db.item.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fees = await db.itemFee.findMany({ where: { itemId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ fees });
}

// POST /api/items/:id/fees { label, amount } — add a charge. If the item has
// already sold, it comes out of the consignor's balance right away.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const amount = Math.round(parsed.data.amount * 100) / 100;

  const item = await db.item.findFirst({ where: { id, storeId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.type !== "CONSIGNED") {
    return NextResponse.json({ error: "Charges only apply to consigned items." }, { status: 400 });
  }

  const result = await db.$transaction(async (tx: any) => {
    const fee = await tx.itemFee.create({ data: { itemId: id, label: parsed.data.label, amount } });
    const charged = item.status === "SOLD" ? await chargeItemFees(tx, item) : 0;
    return { fee, charged };
  });

  return NextResponse.json(result, { status: 201 });
}
