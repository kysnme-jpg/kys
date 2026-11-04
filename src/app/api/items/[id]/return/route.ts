import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Return an unsold item to its consignor: take it off the floor (RETURNED) and
// log the hand-off on the consignor's ledger. Unsold returns carry no money, so
// the balance is untouched. Reversing an already-sold item is a refund (not here).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const item = await db.item.findFirst({ where: { id, storeId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status === "SOLD") {
    return NextResponse.json(
      { error: "This item has already sold — process a refund instead of a return." },
      { status: 400 }
    );
  }
  if (item.status === "RETURNED") {
    return NextResponse.json({ error: "This item is already returned." }, { status: 400 });
  }

  await db.$transaction(async (tx: any) => {
    await tx.item.update({
      where: { id },
      data: { status: "RETURNED" },
    });

    // Record the return on the consignor's ledger for a complete history
    if (item.consignorId && item.type === "CONSIGNED") {
      await tx.ledgerEntry.create({
        data: {
          consignorId: item.consignorId,
          type: "ADJUSTMENT",
          amount: 0,
          note: `Returned "${item.title}" to consignor`,
        },
      });
    }
  });

  return NextResponse.json({ returned: true });
}
