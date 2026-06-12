import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jwtVerify } from "jose";

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || process.env.NEXTAUTH_SECRET || "portal-secret-change-me"
);

export async function getPortalConsignor(req: NextRequest) {
  const token = req.cookies.get("portal_token")?.value
    || req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, PORTAL_SECRET);
    if (payload.type !== "consignor-portal" || !payload.sub) return null;
    return { id: payload.sub as string, storeId: payload.storeId as string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getPortalConsignor(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const consignor = await db.consignor.findUnique({
    where: { id: session.id },
    include: {
      store: { select: { name: true, logoUrl: true } },
      items: {
        where: { status: { in: ["ACTIVE", "SOLD"] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, brand: true, size: true, color: true,
          condition: true, price: true, status: true, soldAt: true,
          photoUrls: true, splitPercent: true, createdAt: true,
          category: { select: { name: true } },
        },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, type: true, amount: true, note: true, createdAt: true },
      },
    },
  });

  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(consignor);
}
