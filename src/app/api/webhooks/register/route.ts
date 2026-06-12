import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { z } from "zod";

const VALID_EVENTS = [
  "sale.created", "sale.refunded",
  "payout.created",
  "item.created", "item.sold",
  "consignor.created",
  "contract.signed",
];

const schema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const endpoints = await db.webhookEndpoint.findMany({
    where: { storeId },
    select: { id: true, url: true, events: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ endpoints, availableEvents: VALID_EVENTS });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const body = await req.json();
  const { url, events } = schema.parse(body);

  const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length) {
    return NextResponse.json({ error: `Invalid events: ${invalidEvents.join(", ")}` }, { status: 400 });
  }

  const secret = crypto.randomBytes(32).toString("hex");

  const endpoint = await db.webhookEndpoint.create({
    data: { storeId, url, events, secret },
    select: { id: true, url: true, events: true, secret: true, createdAt: true },
  });

  return NextResponse.json(endpoint, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await req.json();

  await db.webhookEndpoint.updateMany({ where: { id, storeId }, data: { active: false } });
  return NextResponse.json({ deleted: true });
}
