import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Edit a payout. Changing the amount re-reconciles the consignor balance and
// the payout's ledger entry so the books stay correct.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const payout = await db.payout.findFirst({ where: { id, storeId } });
  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, any> = {};
  for (const k of ["method", "status", "checkNumber", "destination", "note"] as const) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }

  const newAmount = body.amount !== undefined ? Math.max(0, Number(body.amount) || 0) : payout.amount;
  const delta = newAmount - payout.amount;

  if (delta !== 0) {
    // Available to re-allocate = current balance + what this payout already took.
    const consignor = await db.consignor.findUnique({ where: { id: payout.consignorId } });
    if (!consignor) return NextResponse.json({ error: "Consignor not found" }, { status: 404 });
    if (newAmount > consignor.balance + payout.amount) {
      return NextResponse.json({ error: "Amount exceeds the consignor's available balance" }, { status: 400 });
    }
  }

  await db.$transaction(async (tx: any) => {
    await tx.payout.update({ where: { id }, data: { ...data, amount: newAmount } });
    if (delta !== 0) {
      await tx.consignor.update({ where: { id: payout.consignorId }, data: { balance: { decrement: delta } } });
      await tx.ledgerEntry.updateMany({
        where: { payoutId: id, type: "PAYOUT_DEBIT" },
        data: { amount: -newAmount },
      });
    }
  });

  return NextResponse.json({ updated: true });
}
