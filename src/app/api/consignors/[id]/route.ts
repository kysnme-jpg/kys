import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const consignor = await db.consignor.findFirst({
    where: { id, storeId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: { category: { select: { name: true } } },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(consignor);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const storeId = (session.user as any).storeId;
  const body = await req.json();

  const data: Record<string, any> = {};
  for (const k of ["firstName", "lastName", "email", "phone", "address", "notes", "zelleHandle", "cashAppHandle"] as const) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.splitPercent !== undefined) data.splitPercent = Math.max(0, Math.min(100, Number(body.splitPercent) || 0));
  if (body.portalEnabled !== undefined) data.portalEnabled = !!body.portalEnabled;
  if (body.payoutMethod !== undefined) data.payoutMethod = body.payoutMethod || null;
  if (body.unsoldPreference !== undefined) data.unsoldPreference = body.unsoldPreference || null;

  const consignor = await db.consignor.updateMany({ where: { id, storeId }, data });

  return NextResponse.json({ updated: consignor.count });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  try {
    const r = await db.consignor.deleteMany({ where: { id, storeId } });
    if (r.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Can't delete a consignor with items, sales, or payouts" }, { status: 409 });
  }
}
