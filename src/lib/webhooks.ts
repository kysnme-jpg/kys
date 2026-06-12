import { db } from "./db";
import crypto from "crypto";

export type WebhookEvent =
  | "sale.created"
  | "sale.refunded"
  | "payout.created"
  | "item.created"
  | "item.sold"
  | "consignor.created"
  | "contract.signed";

export async function fireWebhook(storeId: string, event: WebhookEvent, data: object) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { storeId, active: true, events: { has: event } },
  });

  if (endpoints.length === 0) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const body = JSON.stringify(payload);
      const sig = crypto
        .createHmac("sha256", endpoint.secret)
        .update(body)
        .digest("hex");

      let responseCode: number | null = null;
      let success = false;

      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ConsignPro-Signature": `sha256=${sig}`,
            "X-ConsignPro-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
        responseCode = res.status;
        success = res.ok;
      } catch {
        // Delivery failed — log it
      }

      await db.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event,
          payload,
          responseCode,
          success,
        },
      });
    })
  );
}
