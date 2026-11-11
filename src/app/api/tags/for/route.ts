import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInternal } from "@/lib/authz";

export const runtime = "nodejs";

// The tag ids currently on a given consignor or customer.
export async function GET(req: NextRequest) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  const sp = new URL(req.url).searchParams;
  const consignorId = sp.get("consignorId");
  const customerId = sp.get("customerId");
  if (!consignorId && !customerId) return NextResponse.json({ error: "consignorId or customerId required." }, { status: 400 });

  const rows = await db.tagAssignment.findMany({
    where: {
      ...(consignorId ? { consignorId } : { customerId }),
      tag: { storeId: g.actor.storeId },
    },
    select: { tag: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json({ tags: rows.map((r) => r.tag) });
}
