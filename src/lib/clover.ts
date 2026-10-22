/**
 * Clover REST API client
 * Docs: https://docs.clover.com/reference
 */

// Production: https://api.clover.com  ·  Sandbox: https://sandbox.dev.clover.com
// Override the host with CLOVER_API_BASE (e.g. to test against sandbox).
const CLOVER_API_BASE = `${process.env.CLOVER_API_BASE || "https://api.clover.com"}/v3`;

interface CloverConfig {
  apiKey: string;
  merchantId: string;
}

export class CloverClient {
  private apiKey: string;
  private merchantId: string;
  private baseUrl: string;

  constructor({ apiKey, merchantId }: CloverConfig) {
    this.apiKey = apiKey;
    this.merchantId = merchantId;
    this.baseUrl = `${CLOVER_API_BASE}/merchants/${merchantId}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Clover API error ${res.status}: ${error}`);
    }

    return res.json();
  }

  // Create a Clover order for a sale
  async createOrder(total: number, items: { name: string; price: number; quantity: number }[]) {
    const order = await this.request<any>("/orders", {
      method: "POST",
      body: JSON.stringify({
        state: "open",
        currency: "USD",
      }),
    });

    // Add line items
    for (const item of items) {
      await this.request(`/orders/${order.id}/line_items`, {
        method: "POST",
        body: JSON.stringify({
          name: item.name,
          price: Math.round(item.price * 100), // Clover uses cents
          unitQty: item.quantity,
        }),
      });
    }

    return order;
  }

  // Get order status
  async getOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}`);
  }

  // Get payments on an order
  async getPayments(orderId: string) {
    return this.request<any>(`/orders/${orderId}/payments`);
  }

  // Refund a payment
  async refundPayment(paymentId: string, amount: number) {
    return this.request<any>(`/payments/${paymentId}/refunds`, {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(amount * 100),
      }),
    });
  }

  // Get merchant info
  async getMerchant() {
    return this.request<any>("");
  }

  // List payments (card transactions) created at/after a given epoch-ms time.
  // Pages through results. Each payment has amount (cents), createdTime (ms).
  async listPayments(sinceMs: number): Promise<any[]> {
    const out: any[] = [];
    let offset = 0;
    const limit = 1000;
    // Safety cap so a huge history can't loop forever.
    for (let page = 0; page < 20; page++) {
      const q = `/payments?filter=${encodeURIComponent(`createdTime>=${sinceMs}`)}&limit=${limit}&offset=${offset}&orderBy=createdTime%20DESC`;
      const res = await this.request<any>(q);
      const elements: any[] = res?.elements || [];
      out.push(...elements);
      if (elements.length < limit) break;
      offset += limit;
    }
    return out;
  }
}

export function getCloverClient(store?: { cloverApiKey?: string | null; cloverMerchantId?: string | null }) {
  // Per-store credentials (DB) take precedence; otherwise fall back to env vars.
  const apiKey = store?.cloverApiKey || process.env.CLOVER_API_KEY;
  const merchantId = store?.cloverMerchantId || process.env.CLOVER_MERCHANT_ID;

  if (!apiKey || !merchantId) {
    throw new Error(
      "Clover credentials not configured. Set CLOVER_API_KEY and CLOVER_MERCHANT_ID environment variables."
    );
  }

  return new CloverClient({ apiKey, merchantId });
}
