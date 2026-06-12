import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCloverClient } from "@/lib/clover";
import { z } from "zod";

const schema = z.object({
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
    quantity: z.number().default(1),
  })),
  total: z.number(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const store = await db.store.findUnique({ where: { id: storeId } });

  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const body = await req.json();
  const data = schema.parse(body);

  try {
    const clover = getCloverClient(store);
    const order = await clover.createOrder(data.total, data.items);
    return NextResponse.json({ orderId: order.id, order });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
