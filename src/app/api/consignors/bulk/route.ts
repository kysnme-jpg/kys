import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Bulk actions on consignors: setSplit, enablePortal, disablePortal, delete.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const { action, ids, value } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No consignors selected" }, { status: 400 });
  }
  const where = { id: { in: ids as string[] }, storeId };

  try {
    if (action === "setSplit") {
      const n = Math.max(0, Math.min(100, Number(value) || 0));
      const r = await db.consignor.updateMany({ where, data: { splitPercent: n } });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "enablePortal") {
      const r = await db.consignor.updateMany({ where, data: { portalEnabled: true } });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "disablePortal") {
      const r = await db.consignor.updateMany({ where, data: { portalEnabled: false } });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "delete") {
      const r = await db.consignor.deleteMany({ where });
      return NextResponse.json({ affected: r.count });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Some consignors couldn't be changed (they may have items or payouts)" }, { status: 409 });
  }
}
