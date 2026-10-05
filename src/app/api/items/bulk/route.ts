import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Bulk actions on items: setStatus, listOnline, unlistOnline, delete, markdownPercent.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const { action, ids, value } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No items selected" }, { status: 400 });
  }
  const where = { id: { in: ids as string[] }, storeId };

  try {
    if (action === "setStatus") {
      const r = await db.item.updateMany({ where, data: { status: value } });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "listOnline" || action === "unlistOnline") {
      const r = await db.item.updateMany({ where, data: { listedOnline: action === "listOnline" } });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "delete") {
      const r = await db.item.deleteMany({ where });
      return NextResponse.json({ affected: r.count });
    }
    if (action === "markdownPercent") {
      // Reduce price by N% for each selected item.
      const pct = Math.max(0, Math.min(100, Number(value) || 0));
      const items = await db.item.findMany({ where, select: { id: true, price: true } });
      await db.$transaction(
        items.map((it: any) =>
          db.item.update({ where: { id: it.id }, data: { price: parseFloat((it.price * (1 - pct / 100)).toFixed(2)) } })
        )
      );
      return NextResponse.json({ affected: items.length });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Some items couldn't be changed (sold items can't be deleted)" }, { status: 409 });
  }
}
