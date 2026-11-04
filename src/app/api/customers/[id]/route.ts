import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const customer = await db.customer.findFirst({ where: { id, storeId } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sales = await db.sale.findMany({
    where: { storeId, customerId: id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { item: { select: { title: true, consignor: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });

  const visits = sales.length;
  const lifetimeSpend = sales.reduce((s, x) => s + x.total, 0);
  const lastVisitAt = sales[0]?.createdAt ?? null;

  // Full itemized purchase history, newest sale first, each sale broken down
  // into its items (title, price, and which consignor it came from).
  const purchases = sales.map((sale) => ({
    saleId: sale.id,
    createdAt: sale.createdAt,
    total: sale.total,
    items: sale.items.map((si) => ({
      title: si.item.title,
      consignorName: si.item.consignor ? `${si.item.consignor.firstName} ${si.item.consignor.lastName}` : null,
      price: si.price,
    })),
  }));

  return NextResponse.json({ ...customer, visits, lifetimeSpend, lastVisitAt, purchases });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const body = await req.json();
  const data: Record<string, any> = {};
  for (const k of ["firstName", "lastName", "email", "phone"] as const) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.points !== undefined) data.points = Math.max(0, parseInt(body.points) || 0);

  const result = await db.customer.updateMany({ where: { id, storeId }, data });
  if (result.count === 0) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  return NextResponse.json({ updated: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  try {
    const result = await db.customer.deleteMany({ where: { id, storeId } });
    if (result.count === 0) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Can't delete a customer with sales history" }, { status: 409 });
  }
}
