import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalConsignor } from "../me/route";

export async function POST(req: NextRequest) {
  // Shared portal resolver (same token + secret as the rest of the portal).
  const session = await getPortalConsignor(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "This is a staff preview — read only." }, { status: 403 });
  const consignorId = session.id;

  const consignor = await db.consignor.findUnique({ where: { id: consignorId } });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (consignor.balance <= 0) {
    return NextResponse.json({ error: "No balance available to request" }, { status: 400 });
  }

  const { method, notes } = await req.json().catch(() => ({}));

  // One open request at a time — a second tap shouldn't create a duplicate.
  const open = await db.payout.findFirst({ where: { consignorId, status: "PENDING" }, select: { id: true, amount: true } });
  if (open) return NextResponse.json({ requested: true, amount: open.amount, payoutId: open.id, alreadyRequested: true });

  // Create a pending payout record (store staff will approve/process it)
  const payout = await db.payout.create({
    data: {
      storeId: consignor.storeId,
      consignorId,
      amount: consignor.balance,
      method: method || "CHECK",
      status: "PENDING",
      note: notes
        ? `Portal request: ${notes}`
        : "Requested via consignor portal",
    },
  });

  return NextResponse.json({ requested: true, amount: consignor.balance, payoutId: payout.id });
}
