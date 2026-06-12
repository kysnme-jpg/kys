import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    allSales,
    recentSales,
    itemsByStatus,
    itemsByCategory,
    topConsignors,
    payoutStats,
    salesByDay,
  ] = await Promise.all([
    // All-time totals
    db.sale.aggregate({
      where: { storeId, status: "COMPLETED" },
      _sum: { total: true, taxAmount: true },
      _count: true,
    }),

    // Last 30 days sales
    db.sale.aggregate({
      where: { storeId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
      _count: true,
    }),

    // Items by status
    db.item.groupBy({
      by: ["status"],
      where: { storeId },
      _count: true,
    }),

    // Items by category
    db.item.groupBy({
      by: ["categoryId"],
      where: { storeId, status: "SOLD" },
      _count: true,
      orderBy: { _count: { categoryId: "desc" } },
      take: 6,
    }),

    // Top consignors by sales
    db.saleItem.groupBy({
      by: ["itemId"],
      where: {
        sale: { storeId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
      },
      _sum: { price: true },
      _count: true,
      orderBy: { _sum: { price: "desc" } },
      take: 5,
    }),

    // Payout totals
    db.payout.aggregate({
      where: { storeId, status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),

    // Sales by day for last 30 days (raw)
    db.sale.findMany({
      where: { storeId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build daily revenue chart data
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = 0;
  }
  for (const s of salesByDay) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (key in dailyMap) dailyMap[key] += s.total;
  }
  const revenueByDay = Object.entries(dailyMap).map(([date, revenue]) => ({
    date: date.slice(5), // MM-DD
    revenue: parseFloat(revenue.toFixed(2)),
  }));

  // Fetch category names for top categories
  const categoryIds = itemsByCategory.map((c) => c.categoryId).filter(Boolean) as string[];
  const categories = categoryIds.length
    ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [];

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const topCategories = itemsByCategory.map((c) => ({
    name: c.categoryId ? catMap[c.categoryId] || "Unknown" : "Uncategorized",
    sold: c._count,
  }));

  // Inventory health
  const statusMap = Object.fromEntries(itemsByStatus.map((s) => [s.status, s._count]));
  const totalItems = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const sellThroughRate = totalItems > 0
    ? parseFloat((((statusMap.SOLD || 0) / totalItems) * 100).toFixed(1))
    : 0;

  return NextResponse.json({
    allTime: {
      revenue: allSales._sum.total || 0,
      transactions: allSales._count,
    },
    last30Days: {
      revenue: recentSales._sum.total || 0,
      transactions: recentSales._count,
    },
    inventory: {
      active: statusMap.ACTIVE || 0,
      sold: statusMap.SOLD || 0,
      returned: statusMap.RETURNED || 0,
      total: totalItems,
      sellThroughRate,
    },
    payouts: {
      totalPaid: payoutStats._sum.amount || 0,
      count: payoutStats._count,
    },
    revenueByDay,
    topCategories,
  });
}
