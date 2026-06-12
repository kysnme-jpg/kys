import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "24");
  const sort = searchParams.get("sort") || "newest";

  const items = await db.item.findMany({
    where: {
      status: "ACTIVE",
      listedOnline: true,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categoryId && { categoryId }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      brand: true,
      size: true,
      color: true,
      condition: true,
      price: true,
      photoUrls: true,
      category: { select: { name: true, slug: true } },
      featuredOnline: true,
    },
    orderBy:
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
        ? { price: "desc" }
        : { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await db.item.count({
    where: { status: "ACTIVE", listedOnline: true },
  });

  return NextResponse.json({ items, total, page, limit });
}
