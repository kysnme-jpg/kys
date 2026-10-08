import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().optional() });

// Staff: block a Saturday from taking appointments.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const { date, reason } = parsed.data;
  const when = parseKey(date);

  await db.consignBlockedDate.upsert({
    where: { storeId_date: { storeId, date: when } },
    update: { reason: reason || null },
    create: { storeId, date: when, reason: reason || null },
  });
  return NextResponse.json({ blocked: true });
}

// Staff: unblock a Saturday.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const when = parseKey(parsed.data.date);

  await db.consignBlockedDate.deleteMany({ where: { storeId, date: when } });
  return NextResponse.json({ unblocked: true });
}
