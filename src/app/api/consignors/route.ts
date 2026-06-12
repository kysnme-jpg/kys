import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createConsignorSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  splitPercent: z.number().min(0).max(100).default(50),
  notes: z.string().optional(),
  portalEnabled: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const consignors = await db.consignor.findMany({
    where: {
      storeId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json({ consignors });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = createConsignorSchema.parse(body);
  const storeId = (session.user as any).storeId;

  const consignor = await db.consignor.create({
    data: { ...data, storeId },
  });

  return NextResponse.json(consignor, { status: 201 });
}
