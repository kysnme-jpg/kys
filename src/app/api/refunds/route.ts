import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcConsignorCredit } from "@/lib/utils";

// Work out how much a consignor was credited for a sold item, so a refund can
// reverse exactly that. Prefer the recorded POS sale line (its price/split may
// differ from the item's current price); fall back to a manual "mark sold"
// ledger credit. Returns the amount and the originating saleId (if any).
async function creditForSoldItem(client: any, storeId: string, itemId: string) {
  // The most recent sale line for this item that hasn't already been refunded.
  const saleItem = await client.saleItem.findFirst({
    where: { itemId, refundedAt: null, sale: { storeId } },
    orderBy: { sale: { createdAt: "desc" } },
    include: { sale: true },
  });
  if (saleItem) {
    return {
      credit: calcConsignorCredit(saleItem.price, saleItem.splitPercent),
      saleId: saleItem.saleId as string | null,
      saleItem,
      ...customerRefund(saleItem),
    };
  }
  const manual = await client.ledgerEntry.findFirst({ where: { itemId, type: "SALE_CREDIT" } });
  return { credit: manual?.amount ?? 0, saleId: (manual?.saleId ?? null) as string | null, saleItem: null, refundAmount: 0, refundTax: 0 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// What the customer gets back for one sale line: its share of any cart-level
// discount, plus its share of the sales tax that was charged.
function customerRefund(saleItem: any): { refundAmount: number; refundTax: number } {
  const sale = saleItem.sale;
  const subtotal = sale.subtotal || 0;
  const discounted = subtotal - (sale.discountAmount || 0);
  const net = subtotal > 0 ? saleItem.price * (discounted / subtotal) : saleItem.price;
  const tax = discounted > 0 ? (sale.taxAmount || 0) * (net / discounted) : 0;
  return { refundAmount: round2(net + tax), refundTax: round2(tax) };
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

  const { credit, refundAmount } = await creditForSoldItem(db, storeId, item.id);
  return NextResponse.json({ ...base, refundable: true, reversal: item.type === "CONSIGNED" ? credit : 0, refundAmount });
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
    const { credit, saleId, saleItem, refundAmount, refundTax } = await creditForSoldItem(tx, storeId, item.id);

    await tx.item.update({ where: { id: item.id }, data: { status: destination, soldAt: null } });

    // Record the refund against the sale so revenue, tax and reports are net of
    // it; take back the loyalty points earned on the refunded amount.
    if (saleItem) {
      await tx.saleItem.update({ where: { id: saleItem.id }, data: { refundedAt: new Date() } });
      const remaining = await tx.saleItem.count({ where: { saleId: saleItem.saleId, refundedAt: null } });
      await tx.sale.update({
        where: { id: saleItem.saleId },
        data: {
          refundedAmount: { increment: refundAmount },
          refundedTax: { increment: refundTax },
          ...(remaining === 0 ? { status: "REFUNDED" } : {}),
        },
      });
      if (saleItem.sale.customerId) {
        const cust = await tx.customer.findUnique({ where: { id: saleItem.sale.customerId }, select: { points: true } });
        if (cust) {
          const takeBack = Math.min(cust.points, Math.floor(refundAmount));
          if (takeBack > 0) await tx.customer.update({ where: { id: saleItem.sale.customerId }, data: { points: { decrement: takeBack } } });
        }
      }
    }

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

    return { reversed: item.type === "CONSIGNED" ? credit : 0, refundAmount };
  });

  return NextResponse.json({
    refunded: true,
    reversed: result.reversed,
    refundAmount: result.refundAmount, // what to hand back to the customer (incl. tax)
    returnTo: destination,
    consignor: item.consignor ? `${item.consignor.firstName} ${item.consignor.lastName}` : null,
    title: item.title,
  });
}
