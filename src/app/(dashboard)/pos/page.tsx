"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Search, X, ShoppingCart, Trash2, Star } from "lucide-react";
import { ReceiptModal } from "@/components/pos/receipt-modal";

interface Item {
  id: string;
  title: string;
  sku: string;
  barcode?: string;
  price: number;
  condition?: string;
  brand?: string;
  consignor?: { firstName: string; lastName: string };
  photoUrls: string[];
}

interface CartItem extends Item {
  cartId: string;
}

export default function POSPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [receiptSale, setReceiptSale] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD_CLOVER">("CARD_CLOVER");
  const [discount, setDiscount] = useState(0);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customer, setCustomer] = useState<{ id: string; firstName: string; lastName: string; points: number } | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [lookingUp, setLookingUp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const POINTS_PER_DOLLAR = 100; // 100 points = $1

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      setLoading(true);
      const res = await fetch(`/api/items?search=${encodeURIComponent(search)}&status=ACTIVE&limit=20`);
      const data = await res.json();
      setResults(data.items || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addToCart = (item: Item) => {
    setCart((prev) => [...prev, { ...item, cartId: Math.random().toString(36) }]);
    setSearch("");
    setResults([]);
    searchRef.current?.focus();
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const lookupCustomer = async () => {
    if (!customerEmail.trim()) return;
    setLookingUp(true);
    const res = await fetch(`/api/customers?email=${encodeURIComponent(customerEmail.trim())}`);
    if (res.ok) {
      const data = await res.json();
      setCustomer(data.customer || null);
      setPointsToRedeem(0);
    }
    setLookingUp(false);
  };

  const clearCustomer = () => {
    setCustomer(null);
    setCustomerEmail("");
    setPointsToRedeem(0);
  };

  const pointsDiscount = pointsToRedeem / POINTS_PER_DOLLAR;
  const subtotal = cart.reduce((sum, i) => sum + i.price, 0);
  const taxRate = 0.08; // TODO: pull from store settings
  const taxAmount = (subtotal - discount - pointsDiscount) * taxRate;
  const total = subtotal - discount - pointsDiscount + taxAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      let cloverOrderId: string | undefined;

      if (paymentMethod === "CARD_CLOVER") {
        const cloverRes = await fetch("/api/clover/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map((i) => ({ name: i.title, price: i.price, quantity: 1 })),
            total,
          }),
        });
        if (cloverRes.ok) {
          const cloverData = await cloverRes.json();
          cloverOrderId = cloverData.orderId;
        }
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ itemId: i.id, price: i.price })),
          paymentMethod,
          discountAmount: discount + pointsDiscount,
          customerId: customer?.id,
          pointsRedeemed: pointsToRedeem,
          cloverOrderId,
        }),
      });

      if (res.ok) {
        const sale = await res.json();
        setLastSale(sale);
        setReceiptSale(sale);
        setCart([]);
        setDiscount(0);
        clearCustomer();
        searchRef.current?.focus();
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left: Item search */}
      <div className="flex-1 flex flex-col p-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or scan barcode..."
            className="pl-10 text-base h-12"
          />
          {search && (
            <button onClick={() => { setSearch(""); setResults([]); }} className="absolute right-3 top-3">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white divide-y overflow-y-auto max-h-[60vh]">
            {results.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="flex items-center gap-4 w-full p-4 hover:bg-indigo-50 text-left transition-colors"
              >
                {item.photoUrls[0] ? (
                  <img src={item.photoUrls[0]} alt={item.title} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                    No img
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.brand && `${item.brand} · `}SKU: {item.sku}
                    {item.consignor && ` · ${item.consignor.firstName} ${item.consignor.lastName}`}
                  </p>
                </div>
                <span className="text-lg font-bold text-indigo-600">{formatCurrency(item.price)}</span>
              </button>
            ))}
          </div>
        )}

        {loading && <p className="text-sm text-gray-500 text-center">Searching...</p>}

        {/* Last sale confirmation */}
        {lastSale && (
          <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-800">Sale complete!</p>
              <p className="text-sm text-green-700">Total: {formatCurrency(lastSale.total)} · ID: {lastSale.id.slice(-8)}</p>
            </div>
            <button
              onClick={() => setReceiptSale(lastSale)}
              className="text-xs text-green-700 hover:text-green-900 font-medium underline"
            >
              View Receipt
            </button>
            <button onClick={() => setLastSale(null)}>
              <X className="h-4 w-4 text-green-600" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Cart ({cart.length})</h2>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <ShoppingCart className="h-10 w-10" />
              <p className="text-sm">Cart is empty</p>
            </div>
          )}
          {cart.map((item) => (
            <div key={item.cartId} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500">{item.condition}</p>
              </div>
              <span className="font-semibold text-gray-900">{formatCurrency(item.price)}</span>
              <button onClick={() => removeFromCart(item.cartId)}>
                <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
              </button>
            </div>
          ))}
        </div>

        {/* Totals & checkout */}
        <div className="border-t border-gray-200 p-4 space-y-3">
          {/* Customer / Loyalty */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" /> Loyalty Points
            </p>
            {customer ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-amber-900 font-medium">{customer.firstName} {customer.lastName}</p>
                  <button onClick={clearCustomer} className="text-amber-600 hover:text-amber-800">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-amber-700">{customer.points} pts available (${(customer.points / POINTS_PER_DOLLAR).toFixed(2)})</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={Math.min(customer.points, Math.floor(subtotal * POINTS_PER_DOLLAR))}
                    step={POINTS_PER_DOLLAR}
                    value={pointsToRedeem || ""}
                    onChange={(e) => setPointsToRedeem(Math.min(parseInt(e.target.value) || 0, customer.points))}
                    className="h-7 text-sm flex-1"
                    placeholder="Points to redeem"
                  />
                  <span className="text-xs text-amber-700 whitespace-nowrap">= {formatCurrency(pointsDiscount)}</span>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupCustomer()}
                  placeholder="Customer email..."
                  className="h-7 text-xs flex-1"
                />
                <Button variant="outline" onClick={lookupCustomer} disabled={lookingUp} className="h-7 text-xs px-2">
                  {lookingUp ? "..." : "Find"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 items-center">
              <span>Discount</span>
              <Input
                type="number"
                min={0}
                value={discount || ""}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 h-7 text-right text-sm"
                placeholder="0.00"
              />
            </div>
            {pointsToRedeem > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Points ({pointsToRedeem} pts)</span>
                <span>-{formatCurrency(pointsDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Tax (8%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMethod("CARD_CLOVER")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                paymentMethod === "CARD_CLOVER"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Card
            </button>
            <button
              onClick={() => setPaymentMethod("CASH")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                paymentMethod === "CASH"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Cash
            </button>
          </div>

          <Button
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
            className="w-full h-12 text-base"
          >
            {processing ? "Processing..." : `Charge ${formatCurrency(total)}`}
          </Button>
        </div>
      </div>

      {receiptSale && (
        <ReceiptModal
          sale={receiptSale}
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
