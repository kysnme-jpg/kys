import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalConsignor } from "../me/route";

// A consignor asks (or un-asks) for one of their unsold items back.
export async function POST(req: NextRequest) {
  const session = await getPortalConsignor(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.preview) return NextResponse.json({ error: "This is a staff preview — read only." }, { status: 403 });

  const { itemId, cancel } = await req.json();
  if (!itemId) return NextResponse.json({ error: "No item" }, { status: 400 });

  const item = await db.item.findFirst({ where: { id: itemId, consignorId: session.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only items still on the floor can be requested." }, { status: 400 });
  }

  const returnRequestedAt = cancel ? null : new Date();
  await db.item.update({ where: { id: itemId }, data: { returnRequestedAt } });
  return NextResponse.json({ ok: true, returnRequestedAt });
}
