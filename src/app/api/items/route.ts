import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateSKU } from "@/lib/utils";

const createItemSchema = z.object({
  consignorId: z.string().optional(),
  categoryId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  type: z.enum(["CONSIGNED", "OWNED"]).default("CONSIGNED"),
  price: z.number().positive(),
  costPrice: z.number().optional(),
  splitPercent: z.number().min(0).max(100).optional(),
  sku: z.string().trim().optional(),
  barcode: z.string().optional(),
  location: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  listedOnline: z.boolean().default(false),
  expiresAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "ACTIVE";
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId");
  const consignorId = searchParams.get("consignorId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const storeId = (session.user as any).storeId;

  const items = await db.item.findMany({
    where: {
      storeId,
      status: status as any,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(consignorId && { consignorId }),
    },
    include: {
      consignor: { select: { id: true, firstName: true, lastName: true, splitPercent: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await db.item.count({
    where: { storeId, status: status as any },
  });

  return NextResponse.json({ items, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = createItemSchema.parse(body);
  const storeId = (session.user as any).storeId;

  const consignor = data.consignorId
    ? await db.consignor.findUnique({ where: { id: data.consignorId } })
    : null;

  const { sku: customSku, ...rest } = data;

  try {
    const item = await db.item.create({
      data: {
        ...rest,
        storeId,
        sku: customSku && customSku.length > 0 ? customSku : generateSKU(),
        splitPercent: data.splitPercent ?? consignor?.splitPercent ?? 50,
        photoUrls: data.photoUrls || [],
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      include: {
        consignor: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That SKU is already in use. Choose a different one." }, { status: 409 });
    }
    throw err;
  }
}
