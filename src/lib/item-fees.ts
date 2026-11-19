// Consignor charges on an item (dry cleaning, alterations, authentication…).
//
// Charges are recorded on the item when the work is done and deducted from the
// consignor's balance when the item SELLS — one "FEE_DEBIT" ledger line per
// item listing what was charged. A refund gives the charges back (and they are
// charged again if the item sells again). An item that never sells is never
// charged.

export const FEE_PRESETS = ["Dry cleaning", "Alterations", "Authentication", "Repair"] as const;
export const MAX_FEE = 10_000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toFixed(2)}`;

type FeeItem = { id: string; title: string; type: string; consignorId: string | null };

export function describeFees(fees: { label: string; amount: number }[]): string {
  return fees.map((f) => `${f.label} ${money(f.amount)}`).join(", ");
}

/**
 * Deduct this item's not-yet-charged fees from its consignor's balance. Call
 * inside the same transaction that marks the item sold. Safe to call more than
 * once: each fee is charged only once (until a refund gives it back).
 * Returns the amount charged.
 */
export async function chargeItemFees(tx: any, item: FeeItem, saleId?: string | null): Promise<number> {
  if (item.type !== "CONSIGNED" || !item.consignorId) return 0;
  const fees = await tx.itemFee.findMany({ where: { itemId: item.id, chargedAt: null }, orderBy: { createdAt: "asc" } });
  if (fees.length === 0) return 0;

  const claimed = await tx.itemFee.updateMany({
    where: { id: { in: fees.map((f: any) => f.id) }, chargedAt: null },
    data: { chargedAt: new Date() },
  });
  if (claimed.count !== fees.length) throw new Error("FEES_CHANGED");

  const total = round2(fees.reduce((s: number, f: any) => s + f.amount, 0));
  if (total <= 0) return 0;
  await tx.ledgerEntry.create({
    data: {
      consignorId: item.consignorId,
      saleId: saleId ?? null,
      itemId: item.id,
      type: "FEE_DEBIT",
      amount: -total,
      note: `Charges for "${item.title}": ${describeFees(fees)}`,
    },
  });
  await tx.consignor.update({ where: { id: item.consignorId }, data: { balance: { decrement: total } } });
  return total;
}

/** What this item's fees have already taken from the consignor (charged, not yet given back). */
export async function chargedFeesTotal(client: any, itemId: string): Promise<number> {
  const fees = await client.itemFee.findMany({ where: { itemId, chargedAt: { not: null } }, select: { amount: true } });
  return round2(fees.reduce((s: number, f: any) => s + f.amount, 0));
}

/**
 * Give back the charges deducted for this item (on a refund, or when a manual
 * "sold" is undone). They stay on the item and are charged again if it sells
 * again. Returns the amount given back.
 */
export async function returnItemFees(tx: any, item: FeeItem, reason: string, saleId?: string | null): Promise<number> {
  if (!item.consignorId) return 0;
  const fees = await tx.itemFee.findMany({ where: { itemId: item.id, chargedAt: { not: null } } });
  if (fees.length === 0) return 0;
  await tx.itemFee.updateMany({ where: { id: { in: fees.map((f: any) => f.id) } }, data: { chargedAt: null } });

  const total = round2(fees.reduce((s: number, f: any) => s + f.amount, 0));
  if (total <= 0) return 0;
  await tx.ledgerEntry.create({
    data: {
      consignorId: item.consignorId,
      saleId: saleId ?? null,
      itemId: item.id,
      type: "ADJUSTMENT",
      amount: total,
      note: `Charges returned for "${item.title}" — ${reason}`,
    },
  });
  await tx.consignor.update({ where: { id: item.consignorId }, data: { balance: { increment: total } } });
  return total;
}

/**
 * Share a set's charges across the pieces it is split into: each charge is
 * divided evenly, with any leftover cent going to the first pieces so the
 * pieces add up to exactly the original.
 */
export function splitFees(fees: { label: string; amount: number }[], pieces: number): { label: string; amount: number }[][] {
  const out: { label: string; amount: number }[][] = Array.from({ length: pieces }, () => []);
  for (const f of fees) {
    const totalCents = Math.round(f.amount * 100);
    const base = Math.floor(totalCents / pieces);
    let extra = totalCents - base * pieces;
    for (let i = 0; i < pieces; i++) {
      const cents = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      if (cents > 0) out[i].push({ label: f.label, amount: cents / 100 });
    }
  }
  return out;
}
