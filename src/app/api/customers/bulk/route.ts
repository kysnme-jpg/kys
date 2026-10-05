import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Bulk actions on customers: delete, addPoints, setPoints.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const { action, ids, value } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No customers selected" }, { status: 400 });
  }
  const where = { id: { in: ids as string[] }, storeId };

  try {
    if (action === "delete") {
      const r = await db.customer.deleteMany({ where });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "addPoints") {
      const n = parseInt(value);
      if (isNaN(n)) return NextResponse.json({ error: "Invalid points value" }, { status: 400 });
      const r = await db.customer.updateMany({ where, data: { points: { increment: n } } });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "setPoints") {
      const n = Math.max(0, parseInt(value) || 0);
      const r = await db.customer.updateMany({ where, data: { points: n } });
      return NextResponse.json({ affected: r.count });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Some customers couldn't be updated (sales history?)" }, { status: 409 });
  }
}
