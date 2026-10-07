import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcConsignorCredit } from "@/lib/utils";

// Backfill consignor credits for items that are already marked SOLD but were
// never credited (e.g. imported sales, or items marked sold before crediting
// existed). For each SOLD consigned item with no POS SaleItem and no existing
// SALE_CREDIT ledger entry, create the credit and bump the consignor balance.
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const items = await db.item.findMany({
    where: { storeId, status: "SOLD", type: "CONSIGNED", consignorId: { not: null } },
    include: { consignor: true, saleItems: { select: { id: true } } },
  });

  let credited = 0;
  let totalAmount = 0;

  for (const it of items) {
    if (it.saleItems.length > 0) continue; // sold through POS — already credited
    const existingCredit = await db.ledgerEntry.findFirst({ where: { itemId: it.id, type: "SALE_CREDIT" } });
    if (existingCredit) continue;

    const split = (it.splitPercent ?? it.consignor?.splitPercent ?? 50) as number;
    const credit = calcConsignorCredit(it.price, split);
    if (credit <= 0) continue;

    await db.$transaction(async (tx: any) => {
      await tx.ledgerEntry.create({
        data: { consignorId: it.consignorId, itemId: it.id, type: "SALE_CREDIT", amount: credit, note: `Sold: "${it.title}" — ${split}% split (reconciled)` },
      });
      await tx.consignor.update({ where: { id: it.consignorId }, data: { balance: { increment: credit } } });
    });
    credited++;
    totalAmount += credit;
  }

  return NextResponse.json({ credited, totalAmount: parseFloat(totalAmount.toFixed(2)) });
}
