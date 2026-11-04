import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcConsignorCredit } from "@/lib/utils";

// Work out how much a consignor was credited for a sold item, so a refund can
// reverse exactly that. Prefer the recorded POS sale line (its price/split may
// differ from the item's current price); fall back to a manual "mark sold"
// ledger credit. Returns the amount and the originating saleId (if any).
async function creditForSoldItem(client: any, storeId: string, itemId: string) {
  const saleItem = await client.saleItem.findFirst({
    where: { itemId, sale: { storeId, status: "COMPLETED" } },
    orderBy: { sale: { createdAt: "desc" } },
  });
  if (saleItem) {
    return { credit: calcConsignorCredit(saleItem.price, saleItem.splitPercent), saleId: saleItem.saleId };
  }
  const manual = await client.ledgerEntry.findFirst({ where: { itemId, type: "SALE_CREDIT" } });
  return { credit: manual?.amount ?? 0, saleId: manual?.saleId ?? null };
}

// GET /api/refunds?code=<sku|barcode> — preview what refunding this item would do.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const code = (new URL(req.url).searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const item = await db.item.findFirst({
    where: { storeId, OR: [{ sku: code }, { barcode: code }] },
    include: { consignor: { select: { firstName: true, lastName: true } } },
  });
  if (!item) return NextResponse.json({ found: false });

  const base = {
    found: true,
    item: {
      id: item.id,
      sku: item.sku,
      title: item.title,
      brand: item.brand,
      price: item.price,
      status: item.status,
      consignor: item.consignor ? `${item.consignor.firstName} ${item.consignor.lastName}` : null,
    },
  };

  if (item.status !== "SOLD") {
    return NextResponse.json({ ...base, refundable: false, reason: `This item is ${item.status.toLowerCase()}, not sold — nothing to refund.` });
  }

  const { credit } = await creditForSoldItem(db, storeId, item.id);
  return NextResponse.json({ ...base, refundable: true, reversal: item.type === "CONSIGNED" ? credit : 0 });
}

// POST /api/refunds { itemId, returnTo: "ACTIVE" | "RETURNED" }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const { itemId, returnTo } = await req.json();
  if (!itemId) return NextResponse.json({ error: "No item" }, { status: 400 });
  const destination = returnTo === "RETURNED" ? "RETURNED" : "ACTIVE";

  const item = await db.item.findFirst({ where: { id: itemId, storeId }, include: { consignor: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "SOLD") {
    return NextResponse.json({ error: "Only a sold item can be refunded." }, { status: 400 });
  }

  const result = await db.$transaction(async (tx: any) => {
    const { credit, saleId } = await creditForSoldItem(tx, storeId, item.id);

    await tx.item.update({ where: { id: item.id }, data: { status: destination, soldAt: null } });

    // Reverse the consignor's credit with a negative adjustment (a debit that
    // undoes the sale credit) and lower their balance to match.
    if (item.type === "CONSIGNED" && item.consignorId && credit > 0) {
      await tx.ledgerEntry.create({
        data: {
          consignorId: item.consignorId,
          saleId,
          itemId: item.id,
          type: "ADJUSTMENT",
          amount: -credit,
          note: `Refund: "${item.title}" — ${destination === "RETURNED" ? "returned to consignor" : "relisted for sale"}`,
        },
      });
      await tx.consignor.update({ where: { id: item.consignorId }, data: { balance: { decrement: credit } } });
    }

    return { reversed: item.type === "CONSIGNED" ? credit : 0 };
  });

  return NextResponse.json({
    refunded: true,
    reversed: result.reversed,
    returnTo: destination,
    consignor: item.consignor ? `${item.consignor.firstName} ${item.consignor.lastName}` : null,
    title: item.title,
  });
}
