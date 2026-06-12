import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { calcConsignorCredit } from "@/lib/utils";

function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic");
  const shopDomain = req.headers.get("x-shopify-shop-domain");
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  const rawBody = await req.text();

  // Verify webhook authenticity
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (secret && hmac && !verifyShopifyWebhook(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (topic === "orders/create" || topic === "orders/paid") {
    await handleOrderCreate(payload);
  }

  if (topic === "orders/cancelled" || topic === "refunds/create") {
    await handleOrderRefund(payload);
  }

  return NextResponse.json({ ok: true });
}

async function handleOrderCreate(order: any) {
  // Match Shopify line items to our items via shopifyId
  const lineItems: any[] = order.line_items || [];

  for (const lineItem of lineItems) {
    const shopifyVariantId = String(lineItem.variant_id || lineItem.product_id);

    const item = await db.item.findFirst({
      where: { shopifyId: shopifyVariantId, status: "ACTIVE" },
      include: { consignor: true },
    });

    if (!item) continue;

    const price = parseFloat(lineItem.price);
    const split = item.splitPercent ?? item.consignor?.splitPercent ?? 50;
    const credit = calcConsignorCredit(price, split);

    await db.$transaction(async (tx: any) => {
      // Record the sale
      const sale = await tx.sale.create({
        data: {
          storeId: item.storeId,
          subtotal: price,
          taxAmount: 0,
          discountAmount: 0,
          total: price,
          paymentMethod: "CARD_CLOVER",
          cloverOrderId: `shopify-${order.id}`,
          receiptEmail: order.email,
          notes: `Shopify order #${order.order_number}`,
          items: {
            create: {
              itemId: item.id,
              price,
              splitPercent: split,
            },
          },
        },
      });

      // Mark item sold
      await tx.item.update({
        where: { id: item.id },
        data: { status: "SOLD", soldAt: new Date() },
      });

      // Credit consignor if consigned
      if (item.consignorId && item.type === "CONSIGNED") {
        await tx.ledgerEntry.create({
          data: {
            consignorId: item.consignorId,
            saleId: sale.id,
            type: "SALE_CREDIT",
            amount: credit,
            note: `Online sale via Shopify order #${order.order_number}`,
          },
        });

        await tx.consignor.update({
          where: { id: item.consignorId },
          data: { balance: { increment: credit } },
        });
      }
    });
  }
}

async function handleOrderRefund(payload: any) {
  const shopifyOrderId = `shopify-${payload.order_id || payload.id}`;

  await db.sale.updateMany({
    where: { cloverOrderId: shopifyOrderId },
    data: { status: "REFUNDED" },
  });
}
