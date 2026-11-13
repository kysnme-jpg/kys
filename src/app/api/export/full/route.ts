import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Owner-only full data export — a single JSON snapshot of the store's business
// data, for a manual backup. Secrets (password hashes, API-key hashes, tokens,
// signature blobs) are intentionally excluded.
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Only an owner can export all data." }, { status: 403 });
  }
  const storeId = (session.user as any).storeId;
  const where = { storeId };

  const [
    store, consignors, items, customers, sales, saleItems, ledgerEntries, payouts,
    categories, contracts, workLogs, layaways, borrowedGarments, sipShopEvents,
    appointments, blockedDates, emailLogs,
  ] = await Promise.all([
    db.store.findUnique({ where: { id: storeId }, select: { id: true, name: true, slug: true, address: true, phone: true, email: true, taxRate: true, currency: true, timezone: true, createdAt: true } }),
    db.consignor.findMany({ where, select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true, splitPercent: true, balance: true, notes: true, payoutMethod: true, zelleHandle: true, cashAppHandle: true, unsoldPreference: true, portalEnabled: true, createdAt: true } }),
    db.item.findMany({ where, select: { id: true, sku: true, barcode: true, title: true, description: true, brand: true, size: true, color: true, condition: true, type: true, status: true, price: true, costPrice: true, location: true, splitPercent: true, consignorId: true, categoryId: true, listedOnline: true, soldAt: true, createdAt: true } }),
    db.customer.findMany({ where, select: { id: true, firstName: true, lastName: true, email: true, phone: true, points: true, birthday: true, source: true, createdAt: true } }),
    db.sale.findMany({ where, select: { id: true, customerId: true, subtotal: true, taxAmount: true, discountAmount: true, total: true, refundedAmount: true, refundedTax: true, status: true, paymentMethod: true, createdAt: true } }),
    db.saleItem.findMany({ where: { sale: { storeId } }, select: { id: true, saleId: true, itemId: true, price: true, splitPercent: true, refundedAt: true } }),
    db.ledgerEntry.findMany({ where: { consignor: { storeId } }, select: { id: true, consignorId: true, type: true, amount: true, note: true, itemId: true, saleId: true, payoutId: true, createdAt: true } }),
    db.payout.findMany({ where, select: { id: true, consignorId: true, amount: true, method: true, status: true, checkNumber: true, destination: true, note: true, createdAt: true, completedAt: true } }),
    db.category.findMany({ where, select: { id: true, name: true, slug: true, parentId: true } }),
    db.contract.findMany({ where, select: { id: true, consignorId: true, title: true, splitPercent: true, status: true, signedAt: true, createdAt: true } }),
    db.workLog.findMany({ where, select: { id: true, employeeName: true, phone: true, date: true, hours: true, payout: true, note: true, createdAt: true } }),
    db.layaway.findMany({ where }),
    db.borrowedGarment.findMany({ where }),
    db.sipShopEvent.findMany({ where }),
    db.consignAppointment.findMany({ where }),
    db.consignBlockedDate.findMany({ where }),
    db.emailLog.findMany({ where, select: { id: true, consignorId: true, to: true, type: true, subject: true, status: true, createdAt: true } }),
  ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    exportedBy: (session.user as any).email || null,
    note: "Full data snapshot (secrets excluded). Keep private.",
    store, consignors, items, customers, sales, saleItems, ledgerEntries, payouts,
    categories, contracts, workLogs, layaways, borrowedGarments, sipShopEvents,
    appointments, blockedDates, emailLogs,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="classic-consigns-backup-${stamp}.json"`,
    },
  });
}
