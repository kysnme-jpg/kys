import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;

  const categories = await db.category.findMany({
    where: { storeId },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const body = await req.json();
  const { name, parentId } = z.object({ name: z.string().min(1), parentId: z.string().optional() }).parse(body);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const category = await db.category.create({
    data: { storeId, name, slug, parentId },
  });

  return NextResponse.json(category, { status: 201 });
}
