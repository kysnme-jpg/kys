import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Look up a single item by its exact SKU or barcode (any status), for
// scan-to-add flows (e.g. the Borrowed agreement form).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const code = (new URL(req.url).searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const item = await db.item.findFirst({
    where: { storeId, OR: [{ sku: code }, { barcode: code }] },
    include: { consignor: { select: { firstName: true, lastName: true } } },
  });

  if (!item) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    item: {
      id: item.id,
      sku: item.sku,
      title: item.title,
      brand: item.brand,
      size: item.size,
      price: item.price,
      status: item.status,
      consignor: item.consignor ? `${item.consignor.firstName} ${item.consignor.lastName}` : null,
    },
  });
}
