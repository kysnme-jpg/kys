import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "sales";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
  };

  let csv = "";
  let filename = "";

  if (type === "sales") {
    const sales = await db.sale.findMany({
      where: { storeId, ...(from || to ? { createdAt: dateFilter } : {}) },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        items: { include: { item: { select: { title: true, sku: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = sales.flatMap((s) =>
      s.items.map((si) => ({
        sale_id: s.id,
        date: s.createdAt.toISOString(),
        customer: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : "Walk-in",
        payment_method: s.paymentMethod,
        item_title: si.item.title,
        item_sku: si.item.sku,
        item_price: si.price.toFixed(2),
        discount: s.discountAmount.toFixed(2),
        tax: s.taxAmount.toFixed(2),
        sale_total: s.total.toFixed(2),
      }))
    );

    csv = toCSV(rows);
    filename = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "inventory") {
    const items = await db.item.findMany({
      where: { storeId },
      include: {
        consignor: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = items.map((i) => ({
      id: i.id,
      sku: i.sku,
      title: i.title,
      brand: i.brand || "",
      category: i.category?.name || "",
      condition: i.condition || "",
      price: i.price.toFixed(2),
      status: i.status,
      type: i.type,
      consignor: i.consignor ? `${i.consignor.firstName} ${i.consignor.lastName}` : "",
      split_percent: i.splitPercent || "",
      created_at: i.createdAt.toISOString(),
      sold_at: i.soldAt?.toISOString() || "",
    }));

    csv = toCSV(rows);
    filename = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "consignors") {
    const consignors = await db.consignor.findMany({
      where: { storeId },
      orderBy: { lastName: "asc" },
    });

    const rows = consignors.map((c) => ({
      id: c.id,
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email || "",
      phone: c.phone || "",
      split_percent: c.splitPercent,
      balance: c.balance.toFixed(2),
      contract_signed: c.contractSignedAt?.toISOString() || "",
      created_at: c.createdAt.toISOString(),
    }));

    csv = toCSV(rows);
    filename = `consignors-${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "ledger") {
    const consignorId = searchParams.get("consignorId");
    const entries = await db.ledgerEntry.findMany({
      where: {
        consignor: { storeId },
        ...(consignorId ? { consignorId } : {}),
        ...(from || to ? { createdAt: dateFilter } : {}),
      },
      include: {
        consignor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = entries.map((e) => ({
      id: e.id,
      consignor: `${e.consignor.firstName} ${e.consignor.lastName}`,
      type: e.type,
      amount: e.amount.toFixed(2),
      note: e.note || "",
      date: e.createdAt.toISOString(),
    }));

    csv = toCSV(rows);
    filename = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
