"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Search, X, ShoppingCart, Trash2, Star, Check } from "lucide-react";
import { ReceiptModal } from "@/components/pos/receipt-modal";

interface Item {
  id: string; title: string; sku: string; barcode?: string; price: number;
  condition?: string; brand?: string; consignor?: { firstName: string; lastName: string }; photoUrls: string[];
}
interface CartItem extends Item { cartId: string; }

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
  const [scanFlash, setScanFlash] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const POINTS_PER_DOLLAR = 100;

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Attach a customer passed from /pos?customerId=…
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("customerId");
    if (!id) return;
    fetch(`/api/customers/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) setCustomer({ id: d.id, firstName: d.firstName, lastName: d.lastName, points: d.points });
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      setLoading(true);
      const res = await fetch(`/api/items?search=${encodeURIComponent(search)}&status=ACTIVE&limit=20`);
      const data = await res.json();
      setResults(data.items || []); setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addToCart = (item: Item) => {
    setCart((prev) => [...prev, { ...item, cartId: Math.random().toString(36) }]);
    setSearch(""); setResults([]); searchRef.current?.focus();
  };

  const handleScanEnter = async () => {
    const code = search.trim();
    if (!code) return;
    let item = results.find((i) => i.barcode === code || i.sku === code);
    if (!item) {
      const res = await fetch(`/api/items?search=${encodeURIComponent(code)}&status=ACTIVE&limit=5`);
      const data = await res.json();
      item = (data.items || []).find((i: any) => i.barcode === code || i.sku === code);
      if (!item && (data.items || []).length === 1) item = data.items[0];
    }
    if (item) { addToCart(item); setScanFlash(`Added: ${item.title}`); setTimeout(() => setScanFlash(""), 1500); }
    else { setScanFlash(`No active item for "${code}"`); setTimeout(() => setScanFlash(""), 1800); }
  };

  const removeFromCart = (cartId: string) => setCart((prev) => prev.filter((i) => i.cartId !== cartId));

  const lookupCustomer = async () => {
    if (!customerEmail.trim()) return;
    setLookingUp(true);
    const res = await fetch(`/api/customers?email=${encodeURIComponent(customerEmail.trim())}`);
    if (res.ok) { const data = await res.json(); setCustomer(data.customer || null); setPointsToRedeem(0); }
    setLookingUp(false);
  };
  const clearCustomer = () => { setCustomer(null); setCustomerEmail(""); setPointsToRedeem(0); };

  const pointsDiscount = pointsToRedeem / POINTS_PER_DOLLAR;
  const subtotal = cart.reduce((sum, i) => sum + i.price, 0);
  const taxRate = 0.08;
  const taxAmount = (subtotal - discount - pointsDiscount) * taxRate;
  const total = subtotal - discount - pointsDiscount + taxAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      let cloverOrderId: string | undefined;
      if (paymentMethod === "CARD_CLOVER") {
        const cloverRes = await fetch("/api/clover/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart.map((i) => ({ name: i.title, price: i.price, quantity: 1 })), total }) });
        if (cloverRes.ok) cloverOrderId = (await cloverRes.json()).orderId;
      }
      const res = await fetch("/api/sales", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((i) => ({ itemId: i.id, price: i.price })), paymentMethod, discountAmount: discount + pointsDiscount, customerId: customer?.id, pointsRedeemed: pointsToRedeem, cloverOrderId }),
      });
      if (res.ok) {
        const sale = await res.json();
        setLastSale(sale); setReceiptSale(sale); setCart([]); setDiscount(0); clearCustomer(); searchRef.current?.focus();
      }
    } finally { setProcessing(false); }
  };

  return (
    <div className="px-11 pt-9 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="flex gap-8 items-start max-[900px]:flex-col">
        {/* LEFT */}
        <div className="flex-1 min-w-0 w-full">
          <p className="text-[15px] font-medium text-[var(--muted)] mb-1.5">Point of Sale</p>
          <h1 className="font-serif text-[40px] sm:text-[60px] leading-none text-ink mb-6">New sale</h1>

          <div className="relative mb-3">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-[22px] w-[22px] text-[var(--muted)]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScanEnter(); } }}
              placeholder="Scan a barcode, or search by name or SKU"
              className="w-full h-[68px] rounded-full border-[1.5px] border-line bg-surface pl-14 pr-12 text-[20px] text-ink placeholder:text-[var(--placeholder)] focus:outline-none focus:border-accent"
            />
            {search && <button onClick={() => { setSearch(""); setResults([]); }} className="absolute right-5 top-1/2 -translate-y-1/2"><X className="h-5 w-5 text-[var(--muted)]" /></button>}
          </div>

          {scanFlash && (
            <div className={`rounded-2xl px-4 py-3 text-[15px] font-semibold mb-3 ${scanFlash.startsWith("Added") ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--danger-bg)] text-[var(--danger-ink)]"}`}>{scanFlash}</div>
          )}

          {results.length > 0 && (
            <div className="rounded-[22px] border-[1.5px] border-line-soft bg-surface divide-y divide-[var(--line-soft)] overflow-hidden mb-4">
              {results.map((item) => (
                <button key={item.id} onClick={() => addToCart(item)} className="flex items-center gap-4 w-full h-[72px] px-4 hover:bg-chip text-left transition-colors">
                  {item.photoUrls[0] ? <img src={item.photoUrls[0]} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" /> : <div className="h-14 w-14 rounded-xl bg-chip flex items-center justify-center text-[var(--muted)] shrink-0"><ShoppingCart className="h-5 w-5" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-semibold text-ink truncate">{item.title}</p>
                    <p className="text-[14px] font-medium text-[var(--muted)] truncate">{[item.brand, item.sku, item.consignor && `${item.consignor.firstName} ${item.consignor.lastName}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="text-[20px] font-bold text-accent shrink-0">{formatCurrency(item.price)}</span>
                </button>
              ))}
            </div>
          )}

          {loading && <p className="text-[var(--muted)]">Searching…</p>}

          {lastSale && (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--ok-bg)] p-4">
              <div className="h-10 w-10 bg-[var(--ok-ink)] rounded-full flex items-center justify-center shrink-0"><Check className="h-5 w-5 text-white" /></div>
              <div className="flex-1"><p className="font-semibold text-[var(--ok-ink)]">Sale complete</p><p className="text-sm text-[var(--ok-ink)]">{formatCurrency(lastSale.total)} · #{lastSale.id.slice(-8)}</p></div>
              <Button size="sm" variant="outline" onClick={() => setReceiptSale(lastSale)}>View receipt</Button>
              <button onClick={() => setLastSale(null)}><X className="h-5 w-5 text-[var(--ok-ink)]" /></button>
            </div>
          )}
        </div>

        {/* RIGHT: cart (dark panel) */}
        <aside className="w-[420px] max-[1100px]:w-[380px] max-[900px]:w-full shrink-0 lg:sticky lg:top-9">
          <div className="bg-panel text-[var(--panel-ink)] rounded-[28px] flex flex-col overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center gap-2 border-b border-[var(--panel-key)]">
              <ShoppingCart className="h-5 w-5" /><h2 className="font-serif text-[24px]">Cart</h2>
              <span className="ml-auto text-[14px] text-[var(--panel-muted)]">{cart.length} item{cart.length === 1 ? "" : "s"}</span>
            </div>

            <div className="max-h-[42vh] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--panel-muted)] gap-2"><ShoppingCart className="h-9 w-9" /><p>Cart is empty</p></div>
              ) : cart.map((item) => (
                <div key={item.cartId} className="flex items-center gap-3 h-16 px-6 border-b border-[var(--panel-key)]">
                  <div className="flex-1 min-w-0"><p className="text-[15px] font-semibold truncate">{item.title}</p>{item.brand && <p className="text-[13px] text-[var(--panel-muted)] truncate">{item.brand}</p>}</div>
                  <span className="font-semibold">{formatCurrency(item.price)}</span>
                  <button onClick={() => removeFromCart(item.cartId)} className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-[var(--panel-key)]"><Trash2 className="h-4 w-4 text-[var(--panel-muted)]" /></button>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 space-y-3 border-t border-[var(--panel-key)]">
              {/* Customer chip */}
              {customer ? (
                <div className="flex items-center gap-3 bg-[var(--panel-key)] rounded-2xl p-3">
                  <Avatar id={customer.id} first={customer.firstName} last={customer.lastName} size={40} />
                  <div className="flex-1 min-w-0"><p className="text-[15px] font-semibold truncate">{customer.firstName} {customer.lastName}</p>{customer.points > 0 && <p className="text-[13px] text-[var(--panel-muted)]">{customer.points} pts</p>}</div>
                  <button onClick={clearCustomer} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#443b30]"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupCustomer()} placeholder="Customer email" className="flex-1 min-w-0 h-11 rounded-full bg-[var(--panel-key)] px-4 text-[15px] text-[var(--panel-ink)] placeholder:text-[var(--panel-muted)] focus:outline-none" />
                  <button onClick={lookupCustomer} disabled={lookingUp} className="h-11 px-4 rounded-full border-[1.5px] border-[var(--panel-line)] text-[15px] font-semibold">{lookingUp ? "…" : "Find"}</button>
                </div>
              )}
              {customer && customer.points > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-[var(--panel-muted)]" />
                  <input type="number" min={0} max={Math.min(customer.points, Math.floor(subtotal * POINTS_PER_DOLLAR))} step={POINTS_PER_DOLLAR} value={pointsToRedeem || ""} onChange={(e) => setPointsToRedeem(Math.min(parseInt(e.target.value) || 0, customer.points))} placeholder="Redeem points" className="flex-1 h-10 rounded-full bg-[var(--panel-key)] px-4 text-[14px] text-[var(--panel-ink)] placeholder:text-[var(--panel-muted)] focus:outline-none" />
                  <span className="text-[13px] text-[var(--panel-muted)] whitespace-nowrap">−{formatCurrency(pointsDiscount)}</span>
                </div>
              )}

              {/* Totals */}
              <div className="space-y-1.5 text-[15px] pt-1">
                <div className="flex justify-between text-[var(--panel-muted)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between items-center text-[var(--panel-muted)]"><span>Discount</span>
                  <input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-20 h-8 rounded-lg bg-[var(--panel-key)] px-2 text-right text-[14px] text-[var(--panel-ink)] focus:outline-none" />
                </div>
                <div className="flex justify-between text-[var(--panel-muted)]"><span>Tax (8%)</span><span>{formatCurrency(taxAmount)}</span></div>
                <div className="flex justify-between font-bold text-[18px] pt-2 border-t border-[var(--panel-key)]"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              {/* Payment pills */}
              <div className="flex gap-2">
                {(["CARD_CLOVER", "CASH"] as const).map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 h-[52px] rounded-full text-[15px] font-semibold transition-colors ${paymentMethod === m ? "bg-accent text-[var(--accent-ink)]" : "bg-[var(--panel-key)] text-[var(--panel-ink)]"}`}>{m === "CASH" ? "Cash" : "Card"}</button>
                ))}
              </div>

              <button onClick={handleCheckout} disabled={cart.length === 0 || processing} className="w-full h-16 rounded-full bg-accent text-[var(--accent-ink)] text-[18px] font-bold active:scale-[.98] transition disabled:opacity-45 disabled:active:scale-100">
                {processing ? "Processing…" : `Charge ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
