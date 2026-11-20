import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayRange, isDateKey, todayIn } from "@/lib/day-range";

export const runtime = "nodejs";

const PAYMENT: Record<string, string> = { CASH: "Cash", CARD_CLOVER: "Card", STORE_CREDIT: "Store credit", SPLIT: "Split" };

const fullName = (c?: { firstName: string; lastName: string } | null) =>
  c ? `${c.firstName} ${c.lastName}`.trim() : null;

/**
 * GET /api/sales/day?date=YYYY-MM-DD — every item sold on one day (the store's
 * own calendar day; defaults to today), with its consignor: register sales,
 * online orders, and items marked sold by hand.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const store = await db.store.findUnique({ where: { id: storeId }, select: { timezone: true } });
  const tz = store?.timezone;
  const asked = new URL(req.url).searchParams.get("date");
  const today = todayIn(tz);
  const date = isDateKey(asked) ? asked : today;
  const { start, end } = dayRange(date, tz);

  const itemSelect = {
    id: true, title: true, sku: true, brand: true, size: true, type: true, price: true, soldAt: true,
    consignor: { select: { id: true, firstName: true, lastName: true } },
  } as const;

  // Register and online sales rung up that day.
  const lines = await db.saleItem.findMany({
    where: { sale: { storeId, createdAt: { gte: start, lt: end } } },
    include: {
      sale: { select: { id: true, createdAt: true, paymentMethod: true, cloverOrderId: true, customer: { select: { firstName: true, lastName: true } } } },
      item: { select: itemSelect },
    },
  });

  // Items marked sold by hand that day (no register sale that day).
  const onSale = new Set(lines.map((l) => l.itemId));
  const manual = await db.item.findMany({
    where: { storeId, status: "SOLD", soldAt: { gte: start, lt: end }, id: { notIn: [...onSale] } },
    select: itemSelect,
  });

  const rows = [
    ...lines.map((l) => ({
      key: l.id,
      itemId: l.itemId,
      time: l.sale.createdAt,
      title: l.item.title,
      sku: l.item.sku,
      brand: l.item.brand,
      size: l.item.size,
      consignor: l.item.type === "CONSIGNED" ? fullName(l.item.consignor) : null,
      consignorId: l.item.type === "CONSIGNED" ? l.item.consignor?.id ?? null : null,
      storeOwned: l.item.type === "OWNED",
      price: l.price,
      how: l.sale.cloverOrderId?.startsWith("shopify-") ? "Online" : PAYMENT[l.sale.paymentMethod] || l.sale.paymentMethod,
      saleId: l.sale.id,
      customer: fullName(l.sale.customer),
      refunded: !!l.refundedAt,
    })),
    ...manual.map((it) => ({
      key: `item-${it.id}`,
      itemId: it.id,
      time: it.soldAt!,
      title: it.title,
      sku: it.sku,
      brand: it.brand,
      size: it.size,
      consignor: it.type === "CONSIGNED" ? fullName(it.consignor) : null,
      consignorId: it.type === "CONSIGNED" ? it.consignor?.id ?? null : null,
      storeOwned: it.type === "OWNED",
      price: it.price,
      how: "Marked sold",
      saleId: null,
      customer: null,
      refunded: false,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const kept = rows.filter((r) => !r.refunded);
  return NextResponse.json({
    date,
    today,
    timezone: tz || "America/New_York",
    rows,
    count: kept.length,
    total: Math.round(kept.reduce((s, r) => s + r.price, 0) * 100) / 100,
  });
}
