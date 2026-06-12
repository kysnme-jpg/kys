import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jwtVerify } from "jose";
import { z } from "zod";
import { generateSKU } from "@/lib/utils";

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || process.env.NEXTAUTH_SECRET || "portal-secret-change-me"
);

const submitSchema = z.object({
  items: z.array(z.object({
    title: z.string().min(1),
    brand: z.string().optional(),
    size: z.string().optional(),
    color: z.string().optional(),
    condition: z.string().optional(),
    description: z.string().optional(),
    photoUrls: z.array(z.string()).optional(),
    suggestedPrice: z.number().positive().optional(),
    categoryName: z.string().optional(),
  })).min(1).max(50),
  notes: z.string().optional(),
});

async function getConsignorFromToken(req: NextRequest) {
  const token = req.cookies.get("portal_token")?.value
    || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, PORTAL_SECRET);
    if (payload.type !== "consignor-portal") return null;
    return { id: payload.sub as string, storeId: payload.storeId as string };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const session = await getConsignorFromToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { items, notes } = submitSchema.parse(body);

  const consignor = await db.consignor.findUnique({
    where: { id: session.id },
    select: { id: true, storeId: true, splitPercent: true },
  });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const created = await db.item.createMany({
    data: items.map((item) => ({
      storeId: consignor.storeId,
      consignorId: consignor.id,
      sku: generateSKU(),
      title: item.title,
      brand: item.brand,
      size: item.size,
      color: item.color,
      condition: item.condition || "Good",
      description: item.description,
      photoUrls: item.photoUrls || [],
      price: item.suggestedPrice || 0,
      splitPercent: consignor.splitPercent,
      type: "CONSIGNED" as const,
      status: "ACTIVE" as const,
    })),
  });

  return NextResponse.json({
    submitted: created.count,
    message: `${created.count} item(s) submitted for review. The store will set final prices.`,
  });
}
