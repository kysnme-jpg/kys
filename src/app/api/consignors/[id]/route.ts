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

  const consignor = await db.consignor.updateMany({
    where: { id, storeId },
    data: body,
  });

  return NextResponse.json({ updated: consignor.count });
}
