"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, calcConsignorCredit } from "@/lib/utils";
import {
  DollarSign, Package, TrendingUp, LogOut, ShoppingBag, Clock, Send,
  MessageCircle, RotateCcw, Check, Undo2, KeyRound,
} from "lucide-react";

interface PortalData {
  firstName: string; lastName: string; balance: number; splitPercent: number;
  store: { name: string; logoUrl?: string };
  items: any[]; ledgerEntries: any[]; portalMustReset?: boolean;
}
interface Msg { id: string; sender: string; body: string; createdAt: string; }

export default function PortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"items" | "ledger" | "messages">("items");
  const router = useRouter();

  // payout
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("CHECK");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [payoutRequested, setPayoutRequested] = useState(false);

  // returns
  const [busyItem, setBusyItem] = useState<string | null>(null);

  // messages
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const authHeaders = useCallback((json = false): Record<string, string> => {
    const token = (() => { try { return localStorage.getItem("portal_token"); } catch { return null; } })();
    return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }, []);

  const loadMe = useCallback(() => {
    fetch("/api/portal/me", { headers: authHeaders() })
      .then((r) => { if (r.status === 401) { router.push("/portal/login"); return null; } return r.json(); })
      .then((d) => { if (d) { setData(d); setLoading(false); } });
  }, [authHeaders, router]);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => {
    fetch("/api/portal/messages", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setMessages(d.messages || []); });
  }, [authHeaders]);

  useEffect(() => {
    if (tab === "messages" && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [tab, messages]);

  const requestPayout = async () => {
    setRequesting(true);
    const res = await fetch("/api/portal/payout-request", {
      method: "POST", headers: authHeaders(true),
      body: JSON.stringify({ method: payoutMethod, notes: payoutNotes }),
    });
    if (res.ok) { setPayoutRequested(true); setPayoutOpen(false); }
    setRequesting(false);
  };

  const toggleReturn = async (item: any) => {
    setBusyItem(item.id);
    const cancel = !!item.returnRequestedAt;
    const res = await fetch("/api/portal/request-return", {
      method: "POST", headers: authHeaders(true),
      body: JSON.stringify({ itemId: item.id, cancel }),
    });
    if (res.ok) {
      setData((d) => d ? { ...d, items: d.items.map((it) => it.id === item.id ? { ...it, returnRequestedAt: cancel ? null : new Date().toISOString() } : it) } : d);
    }
    setBusyItem(null);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await fetch("/api/portal/messages", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ body: text }) });
    if (res.ok) { const d = await res.json(); setMessages((m) => [...m, d.message]); setDraft(""); }
    setSending(false);
  };

  const signOut = () => { try { localStorage.removeItem("portal_token"); } catch {} router.push("/portal/login"); };

  // Forced password reset (after the store resends access with a temp password)
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetErr, setResetErr] = useState("");
  const submitNewPassword = async () => {
    setResetErr("");
    if (newPw.length < 6) { setResetErr("Choose a password of at least 6 characters."); return; }
    if (newPw !== confirmPw) { setResetErr("Those passwords don't match."); return; }
    setResetting(true);
    const res = await fetch("/api/portal/set-password", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ password: newPw }) });
    setResetting(false);
    if (res.ok) { setNewPw(""); setConfirmPw(""); loadMe(); }
    else { const d = await res.json().catch(() => ({})); setResetErr(d.error || "Couldn't set your password."); }
  };

  if (loading || !data) {
    return <div className="min-h-screen bg-paper flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  }

  if (data.portalMustReset) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-surface border border-line rounded-[24px] p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="h-10 w-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, var(--accent), #d98a4e)" }}><KeyRound className="h-5 w-5" /></span>
            <div><p className="font-serif text-[18px] font-semibold leading-none">Choose your password</p><p className="text-[12.5px] text-[var(--muted)] mt-1.5">Welcome, {data.firstName} — set a password to secure your account.</p></div>
          </div>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">New password</label>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters" className="w-full h-12 rounded-xl border-[1.5px] border-line bg-paper px-3.5 text-[15px] text-ink focus:outline-none focus:border-accent mb-3" />
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">Confirm password</label>
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitNewPassword(); }} placeholder="Re-enter it" className="w-full h-12 rounded-xl border-[1.5px] border-line bg-paper px-3.5 text-[15px] text-ink focus:outline-none focus:border-accent mb-3" />
          {resetErr && <p className="text-[13px] text-[var(--danger-ink)] bg-[var(--danger-bg)] rounded-xl px-3 py-2 mb-3">{resetErr}</p>}
          <button onClick={submitNewPassword} disabled={resetting} className="w-full h-12 rounded-full bg-accent text-[var(--accent-ink)] text-[15px] font-bold disabled:opacity-50">{resetting ? "Saving…" : "Save password & continue"}</button>
          <button onClick={signOut} className="w-full mt-2.5 text-[13px] font-semibold text-[var(--muted)]">Sign out</button>
        </div>
      </div>
    );
  }

  const activeItems = data.items.filter((i) => i.status === "ACTIVE");
  const soldItems = data.items.filter((i) => i.status === "SOLD");
  const totalEarned = data.ledgerEntries.filter((e) => e.type === "SALE_CREDIT").reduce((s: number, e: any) => s + e.amount, 0);

  const statusPill = (s: string) => {
    if (s === "ACTIVE") return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[var(--ok-bg)] text-[var(--ok-ink)]">LIVE</span>;
    if (s === "SOLD") return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-chip text-[var(--chip-ink)]">SOLD</span>;
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold" style={{ background: "#f6ecd4", color: "#8a6d1f" }}>{s}</span>;
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line" style={{ background: "color-mix(in srgb, var(--paper) 88%, transparent)", backdropFilter: "blur(8px)", top: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-xl mx-auto px-5 py-3.5 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, var(--accent), #d98a4e)" }}><ShoppingBag className="h-5 w-5 text-white" /></span>
          <div className="min-w-0">
            <p className="font-serif text-[15px] font-semibold leading-none truncate">{data.store.name}</p>
            <p className="text-[12px] text-[var(--muted)] mt-0.5 truncate">{data.firstName} {data.lastName}</p>
          </div>
          <button onClick={signOut} className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--muted)] hover:text-ink"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-5 space-y-4">
        {/* Balance hero */}
        <section className="rounded-[24px] p-6 relative overflow-hidden" style={{ background: "linear-gradient(160deg, var(--panel-key), var(--panel))", color: "var(--panel-ink)" }}>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--panel-muted)" }}>Available balance</p>
          <p className="font-serif text-[44px] font-semibold leading-none mt-1.5 tabular-nums">{formatCurrency(data.balance)}</p>
          {payoutRequested ? (
            <p className="text-[12px] mt-3" style={{ color: "var(--panel-muted)" }}>Payout request submitted — the store will process it shortly.</p>
          ) : (
            <button onClick={() => setPayoutOpen((v) => !v)} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-accent text-[var(--accent-ink)] text-[14px] font-bold"><Send className="h-4 w-4" />Request payout</button>
          )}
          <p className="text-[12px] mt-2.5" style={{ color: "var(--panel-muted)" }}>Hi {data.firstName} — here's everything you've got with us.</p>
        </section>

        {/* Payout request */}
        {payoutOpen && !payoutRequested && (
          <section className="bg-surface border border-line rounded-[18px] p-4">
            <h3 className="font-serif text-[17px] font-semibold">Request a payout</h3>
            <p className="text-[13px] text-[var(--muted)] mt-1 mb-3">Your balance of <b className="text-ink">{formatCurrency(data.balance)}</b> — the store will process it and reach out.</p>
            <div className="flex gap-1.5 mb-3">
              {(["CHECK", "CASH", "ACH"] as const).map((m) => (
                <button key={m} onClick={() => setPayoutMethod(m)} className={`flex-1 h-10 rounded-full text-[13.5px] font-semibold border-[1.5px] ${payoutMethod === m ? "bg-accent border-accent text-[var(--accent-ink)]" : "bg-surface border-line text-ink"}`}>{m === "ACH" ? "Bank (ACH)" : m[0] + m.slice(1).toLowerCase()}</button>
              ))}
            </div>
            <textarea value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} rows={2} placeholder="Any special instructions (optional)" className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={requestPayout} disabled={requesting} className="flex-1 h-11 rounded-full bg-accent text-[var(--accent-ink)] text-[14.5px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"><Send className="h-4 w-4" />{requesting ? "Submitting…" : "Submit request"}</button>
              <button onClick={() => setPayoutOpen(false)} className="h-11 px-4 rounded-full border-[1.5px] border-line text-[14px] font-semibold">Cancel</button>
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Active items", value: String(activeItems.length), Icon: Package, cls: "bg-[#d6ece6] text-[#2b7a66]" },
            { label: "Items sold", value: String(soldItems.length), Icon: TrendingUp, cls: "text-accent", style: { background: "color-mix(in srgb, var(--accent) 16%, transparent)" } },
            { label: "Total earned", value: formatCurrency(totalEarned), Icon: DollarSign, cls: "bg-[#fbead0] text-[#b4822a]" },
          ].map(({ label, value, Icon, cls, style }) => (
            <div key={label} className="bg-surface border border-line rounded-[18px] p-3.5 text-center">
              <div className={`h-8 w-8 rounded-[9px] grid place-items-center mx-auto mb-2 ${cls}`} style={style}><Icon className="h-4 w-4" /></div>
              <p className="font-serif text-[20px] font-semibold tabular-nums">{value}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </section>

        {/* Split */}
        <section className="flex items-center gap-2.5 bg-chip rounded-[16px] px-3.5 py-3">
          <span className="h-8 w-8 rounded-[9px] bg-surface grid place-items-center shrink-0"><TrendingUp className="h-4 w-4 text-accent" /></span>
          <div><b className="text-[13.5px] font-bold block">Your split: {data.splitPercent}%</b><span className="text-[12px] text-[var(--muted)]">You earn {data.splitPercent}% of each item's sale price.</span></div>
        </section>

        {/* Tabs */}
        <div className="inline-flex gap-1 bg-chip rounded-full p-1">
          {([["items", `My items`], ["ledger", "Earnings"], ["messages", "Messages"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-[13.5px] font-semibold ${tab === t ? "bg-surface text-ink shadow-sm" : "text-[var(--muted)]"}`}>{label}</button>
          ))}
        </div>

        {/* Items */}
        {tab === "items" && (
          <section className="space-y-2.5">
            {data.items.length === 0 && <p className="text-[var(--muted)] text-sm py-6 text-center">No items on record yet.</p>}
            {data.items.map((item: any) => (
              <div key={item.id} className="bg-surface border border-line rounded-[18px] p-3">
                <div className="flex gap-3">
                  {item.photoUrls?.[0]
                    ? <img src={item.photoUrls[0]} className="h-16 w-16 rounded-xl object-cover shrink-0" alt="" />
                    : <div className="h-16 w-16 rounded-xl shrink-0 grid place-items-center text-white" style={{ background: "linear-gradient(145deg, var(--accent), #d98a4e)" }}><ShoppingBag className="h-6 w-6" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-[14px] leading-snug">{item.title}</p>
                      {statusPill(item.status)}
                    </div>
                    <p className="text-[12px] text-[var(--muted)] mt-0.5">{[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}</p>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <p className="text-[14.5px] font-extrabold tabular-nums">{formatCurrency(item.price)}</p>
                      <p className="text-[12px] font-bold text-accent">Your share {formatCurrency(calcConsignorCredit(item.price, item.splitPercent ?? data.splitPercent))}</p>
                    </div>
                    {item.status === "SOLD" && item.soldAt && (
                      <p className="text-[11.5px] text-[var(--muted)] mt-1.5 flex items-center gap-1"><Clock className="h-3 w-3" />Sold {formatDate(item.soldAt)}</p>
                    )}
                  </div>
                </div>
                {item.status === "ACTIVE" && (
                  <div className="mt-2.5 pt-2.5 border-t border-line-soft">
                    {item.returnRequestedAt ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-accent inline-flex items-center gap-1.5"><Check className="h-4 w-4" />Return requested — the store will be in touch</span>
                        <button onClick={() => toggleReturn(item)} disabled={busyItem === item.id} className="text-[12.5px] font-semibold text-[var(--muted)] inline-flex items-center gap-1 disabled:opacity-50"><Undo2 className="h-3.5 w-3.5" />Undo</button>
                      </div>
                    ) : (
                      <button onClick={() => toggleReturn(item)} disabled={busyItem === item.id} className="w-full h-10 rounded-full border-[1.5px] border-line text-[13.5px] font-semibold text-ink inline-flex items-center justify-center gap-2 hover:border-accent disabled:opacity-50">
                        <RotateCcw className="h-4 w-4" />{busyItem === item.id ? "…" : "Request this item back"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Earnings / ledger */}
        {tab === "ledger" && (
          <section className="space-y-2">
            {data.ledgerEntries.length === 0 && <p className="text-[var(--muted)] text-sm py-6 text-center">No transactions yet.</p>}
            {data.ledgerEntries.map((e: any) => {
              const tyCls = e.type === "SALE_CREDIT" ? "text-[var(--ok-ink)]" : e.type === "ADJUSTMENT" ? "text-[#2f6fae]" : "text-[var(--danger-ink)]";
              const amtCls = e.amount > 0 ? "text-[var(--ok-ink)]" : e.amount < 0 ? "text-[var(--danger-ink)]" : "text-[var(--muted)]";
              return (
                <div key={e.id} className="bg-surface border border-line rounded-[16px] p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-[10.5px] font-extrabold tracking-wide ${tyCls}`}>{e.type.replace(/_/g, " ")}</p>
                    <p className="text-[13px] mt-0.5 leading-snug">{e.note || "—"}</p>
                    <p className="text-[11.5px] text-[var(--muted)] mt-0.5">{new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className={`font-extrabold text-[15px] tabular-nums whitespace-nowrap ${amtCls}`}>{e.amount >= 0 ? "+" : ""}{formatCurrency(e.amount)}</p>
                </div>
              );
            })}
          </section>
        )}

        {/* Messages */}
        {tab === "messages" && (
          <section className="bg-surface border border-line rounded-[20px] overflow-hidden flex flex-col" style={{ height: "60vh", minHeight: 360 }}>
            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center text-[var(--muted)] gap-2 px-4">
                  <MessageCircle className="h-8 w-8" />
                  <p className="text-[14px]">Message the store directly — questions about your items, pricing, or a payout. They'll reply right here.</p>
                </div>
              )}
              {messages.map((m) => {
                const mine = m.sender === "CONSIGNOR";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${mine ? "bg-accent text-[var(--accent-ink)] rounded-br-md" : "bg-chip text-ink rounded-bl-md"}`}>
                      <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10.5px] mt-1 ${mine ? "text-white/70" : "text-[var(--muted)]"}`}>{!mine ? `${data.store.name} · ` : ""}{new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line p-3 flex items-end gap-2" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1} placeholder="Write a message…" className="flex-1 max-h-28 rounded-2xl border-[1.5px] border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent resize-none" />
              <button onClick={send} disabled={!draft.trim() || sending} className="h-11 w-11 rounded-full bg-accent text-[var(--accent-ink)] grid place-items-center shrink-0 disabled:opacity-40"><Send className="h-4.5 w-4.5" /></button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
