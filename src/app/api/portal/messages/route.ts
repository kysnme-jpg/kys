import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalConsignor } from "../me/route";

// Messages between a consignor (via the portal) and the store.
export async function GET(req: NextRequest) {
  const session = await getPortalConsignor(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await db.consignorMessage.findMany({
    where: { consignorId: session.id },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { id: true, sender: true, body: true, createdAt: true },
  });

  // Anything the store sent is now seen by the consignor.
  await db.consignorMessage.updateMany({
    where: { consignorId: session.id, sender: "STORE", readByConsignor: false },
    data: { readByConsignor: true },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const session = await getPortalConsignor(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body } = await req.json();
  const text = String(body || "").trim();
  if (!text) return NextResponse.json({ error: "Write a message first" }, { status: 400 });

  const message = await db.consignorMessage.create({
    data: {
      storeId: session.storeId,
      consignorId: session.id,
      sender: "CONSIGNOR",
      body: text.slice(0, 4000),
      readByStore: false,
      readByConsignor: true,
    },
    select: { id: true, sender: true, body: true, createdAt: true },
  });

  return NextResponse.json({ message }, { status: 201 });
}
