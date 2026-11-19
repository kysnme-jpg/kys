import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// DELETE /api/items/:id/fees/:feeId — remove a charge. If it was already
// deducted (the item sold), the amount goes back on the consignor's balance.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; feeId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id, feeId } = await params;

  const fee = await db.itemFee.findFirst({ where: { id: feeId, itemId: id, item: { storeId } }, include: { item: true } });
  if (!fee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const returned = await db.$transaction(async (tx: any) => {
    const removed = await tx.itemFee.deleteMany({ where: { id: fee.id, chargedAt: fee.chargedAt } });
    if (removed.count !== 1) throw new Error("FEE_CHANGED");
    if (!fee.chargedAt || !fee.item.consignorId || fee.amount <= 0) return 0;
    await tx.ledgerEntry.create({
      data: {
        consignorId: fee.item.consignorId,
        itemId: fee.item.id,
        type: "ADJUSTMENT",
        amount: fee.amount,
        note: `Charge removed for "${fee.item.title}": ${fee.label}`,
      },
    });
    await tx.consignor.update({ where: { id: fee.item.consignorId }, data: { balance: { increment: fee.amount } } });
    return fee.amount;
  }).catch((e: Error) => (e.message === "FEE_CHANGED" ? null : Promise.reject(e)));

  if (returned === null) return NextResponse.json({ error: "This charge was just changed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ deleted: true, returned });
}
