import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Staff: recent email activity across the store (all types).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const type = new URL(req.url).searchParams.get("type") || "";
  const logs = await db.emailLog.findMany({
    where: { storeId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { consignor: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      to: l.to,
      type: l.type,
      subject: l.subject,
      status: l.status,
      createdAt: l.createdAt,
      consignor: l.consignor ? `${l.consignor.firstName} ${l.consignor.lastName}` : null,
    })),
  });
}
