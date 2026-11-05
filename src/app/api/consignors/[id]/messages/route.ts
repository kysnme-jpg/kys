import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Store-side view of the message thread with one consignor.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const consignor = await db.consignor.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.consignorMessage.findMany({
    where: { consignorId: id },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { id: true, sender: true, body: true, createdAt: true },
  });

  // Mark the consignor's messages as read by the store.
  await db.consignorMessage.updateMany({
    where: { consignorId: id, sender: "CONSIGNOR", readByStore: false },
    data: { readByStore: true },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const consignor = await db.consignor.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { body } = await req.json();
  const text = String(body || "").trim();
  if (!text) return NextResponse.json({ error: "Write a message first" }, { status: 400 });

  const message = await db.consignorMessage.create({
    data: {
      storeId,
      consignorId: id,
      sender: "STORE",
      body: text.slice(0, 4000),
      readByStore: true,
      readByConsignor: false,
    },
    select: { id: true, sender: true, body: true, createdAt: true },
  });

  return NextResponse.json({ message }, { status: 201 });
}
