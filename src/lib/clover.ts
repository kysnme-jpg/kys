/**
 * Clover REST API client
 * Docs: https://docs.clover.com/reference
 */

const CLOVER_API_BASE = "https://api.clover.com/v3";

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
}

export function getCloverClient(store: { cloverApiKey?: string | null; cloverMerchantId?: string | null }) {
  if (!store.cloverApiKey || !store.cloverMerchantId) {
    throw new Error("Clover credentials not configured for this store");
  }
  return new CloverClient({
    apiKey: store.cloverApiKey,
    merchantId: store.cloverMerchantId,
  });
}
