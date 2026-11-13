"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Search, X, ShoppingCart, Trash2, Star, Check, RotateCcw } from "lucide-react";
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
  const [mode, setMode] = useState<"sell" | "refund">("sell");
  const [refundPreview, setRefundPreview] = useState<any>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMsg, setRefundMsg] = useState("");
  const [refundDone, setRefundDone] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Scanner auto-submit: a barcode scanner types a burst of very fast keystrokes.
  // We detect that burst and auto-add without needing the Enter key, while plain
  // human typing (name search) still behaves normally.
  const lastKeyRef = useRef(0);
  const rapidRef = useRef(0);
  const scanTimerRef = useRef<any>(null);
  const POINTS_PER_DOLLAR = 100;

  useEffect(() => { searchRef.current?.focus(); }, []);
  const [storeTaxRate, setStoreTaxRate] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/store").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setStoreTaxRate(typeof d.taxRate === "number" ? d.taxRate : 0); }).catch(() => {});
  }, []);

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
      if (mode !== "sell" || !search.trim()) { setResults([]); return; }
      setLoading(true);
      const res = await fetch(`/api/items?search=${encodeURIComponent(search)}&status=ACTIVE&limit=20`);
      const data = await res.json();
      setResults(data.items || []); setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, mode]);

  const addToCart = (item: Item) => {
    setCart((prev) => [...prev, { ...item, cartId: Math.random().toString(36) }]);
    setSearch(""); setResults([]); searchRef.current?.focus();
  };

  const handleScanEnter = async () => {
    // Read the live DOM value — a barcode scanner types faster than React state
    // updates, so `search` can be stale when Enter fires.
    const code = (searchRef.current?.value ?? search).trim();
    if (!code) return;
    // Clear immediately so a rapid follow-up scan isn't clobbered by this lookup.
    setSearch(""); setResults([]);
    if (searchRef.current) searchRef.current.value = "";

    let item = results.find((i) => i.barcode === code || i.sku === code);
    if (!item) {
      const res = await fetch(`/api/items?search=${encodeURIComponent(code)}&status=ACTIVE&limit=5`);
      const data = await res.json();
      const list: any[] = data.items || [];
      item = list.find((i: any) => i.barcode === code || i.sku === code) || (list.length === 1 ? list[0] : undefined);
    }
    if (item) {
      setCart((prev) => [...prev, { ...item!, cartId: Math.random().toString(36) }]);
      searchRef.current?.focus();
      setScanFlash(`Added: ${item.title}`); setTimeout(() => setScanFlash(""), 1500);
    } else {
      setScanFlash(`No active item for "${code}"`); setTimeout(() => setScanFlash(""), 1800);
    }
  };

  // Input handler that auto-submits a scanned barcode (no Enter needed).
  const onSearchInput = (val: string) => {
    const now = performance.now();
    const gap = now - lastKeyRef.current;
    lastKeyRef.current = now;
    if (gap > 120) rapidRef.current = 0;        // a pause = human typing, reset
    else if (gap < 35) rapidRef.current += 1;   // very fast chars = scanner
    setSearch(val);

    clearTimeout(scanTimerRef.current);
    const v = val.trim();
    // Only auto-fire for a scanner-like burst of a SKU-shaped value.
    const action = mode === "sell" ? handleScanEnter : handleRefundScan;
    if (rapidRef.current >= 3 && v.length >= 4 && !/\s/.test(v)) {
      scanTimerRef.current = setTimeout(() => {
        if ((searchRef.current?.value ?? "").trim() === v) { rapidRef.current = 0; action(); }
      }, 80);
    }
  };

  useEffect(() => () => clearTimeout(scanTimerRef.current), []);

  const removeFromCart = (cartId: string) => setCart((prev) => prev.filter((i) => i.cartId !== cartId));

  // --- Refund mode ---
  const switchMode = (m: "sell" | "refund") => {
    setMode(m); setSearch(""); setResults([]); setScanFlash("");
    setRefundPreview(null); setRefundMsg(""); setRefundDone(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const resetRefund = () => { setRefundPreview(null); setRefundMsg(""); setSearch(""); searchRef.current?.focus(); };

  const handleRefundScan = async () => {
    const code = search.trim();
    if (!code) return;
    setRefundMsg(""); setRefundDone(null);
    try {
      const res = await fetch(`/api/refunds?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!data.found) { setRefundPreview(null); setRefundMsg(`No item found for "${code}".`); }
      else if (!data.refundable) { setRefundPreview(null); setRefundMsg(data.reason || "This item can't be refunded."); }
      else { setRefundPreview(data); }
    } catch { setRefundMsg("Couldn't reach the catalog — check your connection."); }
    setSearch("");
  };

  const processRefund = async (returnTo: "ACTIVE" | "RETURNED") => {
    if (!refundPreview) return;
    setRefundBusy(true);
    try {
      const res = await fetch("/api/refunds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: refundPreview.item.id, returnTo }),
      });
      if (res.ok) { setRefundDone(await res.json()); setRefundPreview(null); searchRef.current?.focus(); }
      else { const d = await res.json().catch(() => ({})); setRefundMsg(d.error || "Refund failed."); }
    } finally { setRefundBusy(false); }
  };

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
  // Use the store's tax rate (Settings) so the register shows exactly what the
  // server records. If none is set yet, keep the long-standing 8% on screen and
  // flag it, rather than silently dropping tax at the register.
  const taxRate = storeTaxRate && storeTaxRate > 0 ? storeTaxRate : 0.08;
  const taxRateUnset = storeTaxRate !== null && !(storeTaxRate > 0);
  const taxLabel = `${parseFloat((taxRate * 100).toFixed(3))}%`;
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
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`The sale did not go through — nothing was recorded.\n\n${d.error || "Please try again."}`);
      }
    } catch {
      alert("The sale did not go through — check the connection and try again. Nothing was recorded.");
    } finally { setProcessing(false); }
  };

  return (
    <div className="px-11 pt-9 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="flex gap-8 items-start max-[900px]:flex-col">
        {/* LEFT */}
        <div className="flex-1 min-w-0 w-full">
          <p className="text-[15px] font-medium text-[var(--muted)] mb-1.5">Point of Sale</p>
          <h1 className="font-serif text-[40px] sm:text-[60px] leading-none text-ink mb-4">{mode === "sell" ? "New sale" : "Refund"}</h1>

          {/* Sell / Refund toggle */}
          <div className="inline-flex items-center gap-1 rounded-full bg-chip p-1 h-12 mb-6">
            {(["sell", "refund"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)}
                className={`inline-flex items-center justify-center rounded-full px-5 h-10 text-[15px] font-semibold transition-colors ${mode === m ? "bg-ink text-[var(--panel-ink)]" : "text-[var(--muted)] hover:text-ink"}`}>
                {m === "sell" ? "Sell" : "Refund"}
              </button>
            ))}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-[22px] w-[22px] text-[var(--muted)]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => onSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(scanTimerRef.current); rapidRef.current = 0; mode === "sell" ? handleScanEnter() : handleRefundScan(); } }}
              placeholder={mode === "sell" ? "Scan a barcode, or search by name or SKU" : "Scan a sold item to refund"}
              className="w-full h-[68px] rounded-full border-[1.5px] border-line bg-surface pl-14 pr-12 text-[20px] text-ink placeholder:text-[var(--placeholder)] focus:outline-none focus:border-accent"
            />
            {search && <button onClick={() => { setSearch(""); setResults([]); }} className="absolute right-5 top-1/2 -translate-y-1/2"><X className="h-5 w-5 text-[var(--muted)]" /></button>}
          </div>

          {mode === "sell" && scanFlash && (
            <div className={`rounded-2xl px-4 py-3 text-[15px] font-semibold mb-3 ${scanFlash.startsWith("Added") ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--danger-bg)] text-[var(--danger-ink)]"}`}>{scanFlash}</div>
          )}

          {mode === "refund" && refundMsg && (
            <div className="rounded-2xl px-4 py-3 text-[15px] font-semibold mb-3 bg-[var(--danger-bg)] text-[var(--danger-ink)]">{refundMsg}</div>
          )}
          {mode === "refund" && refundDone && (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--ok-bg)] p-4 mb-3">
              <div className="h-10 w-10 bg-[var(--ok-ink)] rounded-full flex items-center justify-center shrink-0"><Check className="h-5 w-5 text-white" /></div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--ok-ink)]">Refund complete</p>
                <p className="text-sm text-[var(--ok-ink)]">{refundDone.title} · {refundDone.returnTo === "RETURNED" ? "returned to consignor" : "relisted"}{refundDone.refundAmount > 0 ? ` · refund ${formatCurrency(refundDone.refundAmount)} to the customer` : ""}{refundDone.reversed > 0 ? ` · reversed ${formatCurrency(refundDone.reversed)}${refundDone.consignor ? ` from ${refundDone.consignor}` : ""}` : ""}</p>
              </div>
              <button onClick={() => setRefundDone(null)}><X className="h-5 w-5 text-[var(--ok-ink)]" /></button>
            </div>
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

          {mode === "sell" && lastSale && (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--ok-bg)] p-4">
              <div className="h-10 w-10 bg-[var(--ok-ink)] rounded-full flex items-center justify-center shrink-0"><Check className="h-5 w-5 text-white" /></div>
              <div className="flex-1"><p className="font-semibold text-[var(--ok-ink)]">Sale complete</p><p className="text-sm text-[var(--ok-ink)]">{formatCurrency(lastSale.total)} · #{lastSale.id.slice(-8)}</p></div>
              <Button size="sm" variant="outline" onClick={() => setReceiptSale(lastSale)}>View receipt</Button>
              <button onClick={() => setLastSale(null)}><X className="h-5 w-5 text-[var(--ok-ink)]" /></button>
            </div>
          )}
        </div>

        {/* RIGHT: cart (sell) or refund panel */}
        {mode === "sell" && (
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
                <div className="flex justify-between text-[var(--panel-muted)]"><span>Tax ({taxLabel})</span><span>{formatCurrency(taxAmount)}</span></div>
                {taxRateUnset && <div className="text-[12px] text-amber-300">No tax rate is saved in Settings — showing 8%, but sales are being recorded with $0 tax. Set it under Settings.</div>}
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
        )}

        {mode === "refund" && (
        <aside className="w-[420px] max-[1100px]:w-[380px] max-[900px]:w-full shrink-0 lg:sticky lg:top-9">
          <div className="bg-panel text-[var(--panel-ink)] rounded-[28px] flex flex-col overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center gap-2 border-b border-[var(--panel-key)]">
              <RotateCcw className="h-5 w-5" /><h2 className="font-serif text-[24px]">Refund</h2>
            </div>
            <div className="px-6 py-5">
              {!refundPreview ? (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--panel-muted)] gap-2 text-center">
                  <RotateCcw className="h-9 w-9" /><p>Scan a sold item to refund it.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[18px] font-semibold">{refundPreview.item.title}</p>
                    <p className="text-[14px] text-[var(--panel-muted)]">{[refundPreview.item.brand, refundPreview.item.sku].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="space-y-1.5 text-[15px]">
                    <div className="flex justify-between text-[var(--panel-muted)]"><span>Sold for</span><span>{formatCurrency(refundPreview.item.price)}</span></div>
                    {refundPreview.refundAmount > 0 && (
                      <div className="flex justify-between font-semibold"><span>Refund to customer (incl. tax)</span><span>{formatCurrency(refundPreview.refundAmount)}</span></div>
                    )}
                    {refundPreview.item.consignor && (
                      <div className="flex justify-between text-[var(--panel-muted)]"><span>Consignor</span><span className="truncate max-w-[55%]">{refundPreview.item.consignor}</span></div>
                    )}
                    {refundPreview.reversal > 0 && (
                      <div className="flex justify-between font-semibold pt-2 border-t border-[var(--panel-key)]"><span>Reverses credit</span><span>−{formatCurrency(refundPreview.reversal)}</span></div>
                    )}
                  </div>
                  {refundPreview.reversal === 0 && (
                    <p className="text-[13px] text-[var(--panel-muted)]">No consignor credit to reverse (store-owned item).</p>
                  )}
                  <div className="space-y-2 pt-1">
                    <button onClick={() => processRefund("ACTIVE")} disabled={refundBusy} className="w-full h-[52px] rounded-full bg-accent text-[var(--accent-ink)] text-[16px] font-bold active:scale-[.98] transition disabled:opacity-45 disabled:active:scale-100">{refundBusy ? "Processing…" : "Refund & relist"}</button>
                    <button onClick={() => processRefund("RETURNED")} disabled={refundBusy} className="w-full h-[52px] rounded-full bg-[var(--panel-key)] text-[var(--panel-ink)] text-[16px] font-semibold active:scale-[.98] transition disabled:opacity-45 disabled:active:scale-100">Refund &amp; return to consignor</button>
                    <button onClick={resetRefund} className="w-full h-10 text-[14px] text-[var(--panel-muted)] hover:text-[var(--panel-ink)]">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        )}
      </div>

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
