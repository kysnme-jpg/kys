import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { calcConsignorCredit } from "@/lib/utils";
import { sendItemSoldEmail } from "@/lib/email";
import { fireWebhook } from "@/lib/webhooks";

const saleItemSchema = z.object({
  itemId: z.string(),
  price: z.number().positive(),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(["CASH", "CARD_CLOVER", "STORE_CREDIT", "SPLIT"]).default("CARD_CLOVER"),
  customerId: z.string().optional(),
  discountAmount: z.number().min(0).default(0),
  pointsRedeemed: z.number().int().min(0).default(0),
  cloverOrderId: z.string().optional(),
  receiptEmail: z.string().email().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");

  const sales = await db.sale.findMany({
    where: { storeId },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      items: {
        include: {
          item: { select: { title: true, sku: true, consignorId: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ sales });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sale: " + parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") }, { status: 400 });
  }
  const data = parsed.data;
  const storeId = (session.user as any).storeId;

  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  // Fetch all items being sold
  const itemRecords = await db.item.findMany({
    where: {
      id: { in: data.items.map((i) => i.itemId) },
      storeId,
      status: "ACTIVE",
    },
    include: { consignor: true },
  });

  if (itemRecords.length !== data.items.length) {
    return NextResponse.json({ error: "One or more items not found or unavailable" }, { status: 400 });
  }

  const subtotal = data.items.reduce((sum, i) => sum + i.price, 0);

  // A discount can never exceed what's being sold.
  if (data.discountAmount > subtotal + 0.001) {
    return NextResponse.json({ error: "Discount is larger than the sale subtotal." }, { status: 400 });
  }

  // The customer must belong to this store and actually hold the points redeemed.
  if (data.customerId) {
    const customer = await db.customer.findFirst({ where: { id: data.customerId, storeId }, select: { points: true } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });
    if (data.pointsRedeemed > customer.points) {
      return NextResponse.json({ error: `Customer only has ${customer.points} points to redeem.` }, { status: 400 });
    }
  } else if (data.pointsRedeemed > 0) {
    return NextResponse.json({ error: "Attach a customer to redeem points." }, { status: 400 });
  }
  const taxAmount = parseFloat(((subtotal - data.discountAmount) * store.taxRate).toFixed(2));
  const total = parseFloat((subtotal - data.discountAmount + taxAmount).toFixed(2));

  // Create sale + update items + create ledger entries in a transaction
  let sale: any;
  try {
  sale = await db.$transaction(async (tx: any) => {
    const sale = await tx.sale.create({
      data: {
        storeId,
        customerId: data.customerId,
        subtotal,
        taxAmount,
        discountAmount: data.discountAmount,
        total,
        paymentMethod: data.paymentMethod,
        cloverOrderId: data.cloverOrderId,
        receiptEmail: data.receiptEmail,
        notes: data.notes,
        items: {
          create: data.items.map((saleItem: any) => {
            const item = itemRecords.find((i) => i.id === saleItem.itemId)!;
            const split = item.splitPercent ?? item.consignor?.splitPercent ?? 50;
            return {
              itemId: saleItem.itemId,
              price: saleItem.price,
              splitPercent: split,
            };
          }),
        },
      },
    });

    // Mark items as sold and create ledger credits for each consignor
    for (const saleItem of data.items as any[]) {
      const item = itemRecords.find((i: any) => i.id === saleItem.itemId)!;
      const split = item.splitPercent ?? item.consignor?.splitPercent ?? 50;
      const credit = calcConsignorCredit(saleItem.price, split);

      // Only flip ACTIVE → SOLD; if another register sold it a moment ago this
      // matches nothing and the whole sale rolls back (no double-selling).
      const flipped = await tx.item.updateMany({
        where: { id: saleItem.itemId, status: "ACTIVE" },
        data: { status: "SOLD", soldAt: new Date() },
      });
      if (flipped.count !== 1) throw new Error("ITEM_UNAVAILABLE");

      if (item.consignorId && item.type === "CONSIGNED") {
        await tx.ledgerEntry.create({
          data: {
            consignorId: item.consignorId,
            saleId: sale.id,
            type: "SALE_CREDIT",
            amount: credit,
            note: `Sale of "${item.title}" — ${split}% split`,
          },
        });

        // Update consignor running balance
        await tx.consignor.update({
          where: { id: item.consignorId },
          data: { balance: { increment: credit } },
        });
      }
    }

    // Loyalty points: deduct redeemed, award earned (1 point per $1 spent)
    if (data.customerId) {
      const pointsEarned = Math.floor(total);
      await tx.customer.update({
        where: { id: data.customerId },
        // One atomic change (Prisma allows a single operation per field).
        data: { points: { increment: pointsEarned - data.pointsRedeemed } },
      });
    }

    return sale;
  });
  } catch (e) {
    if ((e as Error).message === "ITEM_UNAVAILABLE") {
      return NextResponse.json({ error: "One or more items were just sold or are no longer available." }, { status: 409 });
    }
    throw e;
  }

  // Post-sale: fire emails + webhooks (non-blocking)
  const notifyPromises: Promise<any>[] = [];

  for (const saleItem of data.items as any[]) {
    const item = itemRecords.find((i: any) => i.id === saleItem.itemId)!;
    if (item.consignorId && item.type === "CONSIGNED" && item.consignor?.email) {
      const split = item.splitPercent ?? item.consignor.splitPercent ?? 50;
      const credit = calcConsignorCredit(saleItem.price, split);
      const updatedConsignor = await db.consignor.findUnique({ where: { id: item.consignorId } });

      notifyPromises.push(
        sendItemSoldEmail({
          to: item.consignor.email,
          consignorName: `${item.consignor.firstName} ${item.consignor.lastName}`,
          itemTitle: item.title,
          salePrice: saleItem.price,
          consignorShare: credit,
          newBalance: updatedConsignor?.balance ?? credit,
          storeName: store.name,
        }).catch(() => {})
      );
    }
  }

  notifyPromises.push(
    fireWebhook(storeId, "sale.created", {
      saleId: sale.id,
      total: sale.total,
      itemCount: data.items.length,
    }).catch(() => {})
  );

  await Promise.allSettled(notifyPromises);

  return NextResponse.json(sale, { status: 201 });
}
