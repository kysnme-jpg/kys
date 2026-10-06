"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { formatCurrency } from "@/lib/utils";

const PEOPLE_TABS = [
  { label: "Customers", href: "/customers" },
  { label: "Consignors", href: "/consignors" },
];
import { Search, X, Delete, Plus, Check, Star, Trash2, ChevronRight, Hash } from "lucide-react";

interface Customer {
  id: string; firstName: string; lastName: string;
  email?: string | null; phone?: string | null; points: number; createdAt: string;
  visits?: number; lifetimeSpend?: number; lastVisitAt?: string | null;
}
interface Detail extends Customer { recentPurchases?: { title: string; consignorName: string | null; price: number; soldAt: string }[]; }

const digitsOnly = (s?: string | null) => (s || "").replace(/\D/g, "");
const fmtPhone = (d: string) => {
  const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 10);
  return [a, b, c].filter(Boolean).join(" ");
};
function relDate(iso?: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today"; if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`; if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
const visitsLabel = (c: Customer) => (c.visits && c.visits > 0 ? `${c.visits} visit${c.visits === 1 ? "" : "s"}` : null);

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [digits, setDigits] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phoneSheet, setPhoneSheet] = useState(false); // mobile keypad sheet

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPoints, setBulkPoints] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/customers").then((r) => r.json()).then((d) => { setCustomers(d.customers || []); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  // physical keyboard → keypad when nothing is focused
  const pushDigit = useCallback((d: string) => setDigits((p) => (p.length >= 10 ? p : p + d)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (/^[0-9]$/.test(e.key)) { pushDigit(e.key); }
      else if (e.key === "Backspace") { setDigits((p) => p.slice(0, -1)); }
      else if (e.key === "Escape") { setDigits(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pushDigit]);

  const sorted = useMemo(() =>
    [...customers].sort((a, b) =>
      (`${a.lastName} ${a.firstName}`).toLowerCase().localeCompare((`${b.lastName} ${b.firstName}`).toLowerCase())
    ), [customers]);

  const phoneMatches = useMemo(() =>
    digits.length >= 2 ? customers.filter((c) => digitsOnly(c.phone).includes(digits)) : [], [customers, digits]);

  const nameMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return sorted.filter((c) => (`${c.firstName} ${c.lastName}`).toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
  }, [sorted, search]);

  const recent = useMemo(() => {
    const withVisit = customers.filter((c) => c.lastVisitAt).sort((a, b) => (b.lastVisitAt! > a.lastVisitAt! ? 1 : -1));
    const base = withVisit.length ? withVisit : [...customers].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return base.slice(0, 4);
  }, [customers]);

  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openDetail = async (c: Customer) => {
    setDetail(c);
    const r = await fetch(`/api/customers/${c.id}`);
    if (r.ok) setDetail(await r.json());
  };

  const handleCreate = async () => {
    if (!form.firstName.trim()) { setFormError("First name is required"); return; }
    setSaving(true); setFormError("");
    const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, lastName: form.lastName || "" }) });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error || "Failed"); setSaving(false); return; }
    setCreateOpen(false); setForm({ firstName: "", lastName: "", phone: "", email: "" }); setSaving(false); load();
  };

  const bulk = async (action: string, value?: string) => {
    const res = await fetch("/api/customers/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids: [...selected], value }) });
    if (res.ok) { setSelected(new Set()); setSelectMode(false); load(); }
    return res.ok;
  };

  const mode: "phone" | "search" | "browse" = digits.length >= 2 ? "phone" : search.trim() ? "search" : "browse";

  return (
    <div className="px-11 pt-9 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="flex gap-10">
        {/* LEFT */}
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Customers"
            action={<Button onClick={() => setCreateOpen(true)} className="h-14 px-6 gap-2"><Plus className="h-5 w-5" /> New customer</Button>}
          />
          <SegmentedTabs tabs={PEOPLE_TABS} />

          {/* Search + select */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-[22px] w-[22px] text-[var(--muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="w-full h-[68px] rounded-full border-[1.5px] border-line bg-surface pl-14 pr-32 text-[20px] text-ink placeholder:text-[var(--placeholder)] focus:outline-none focus:border-accent"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {search && <button onClick={() => setSearch("")} className="p-1"><X className="h-5 w-5 text-[var(--muted)]" /></button>}
                <span className="inline-flex items-center h-11 px-3.5 rounded-full bg-chip text-[var(--chip-ink)] text-[15px] font-semibold">{customers.length} people</span>
              </span>
            </div>
            <button onClick={() => setPhoneSheet(true)} className="md:hidden h-[68px] px-5 rounded-full border-[1.5px] border-line bg-surface text-ink font-semibold inline-flex items-center gap-2"><Hash className="h-5 w-5" /></button>
            <Button variant={selectMode ? "dark" : "outline"} className="h-[68px] px-6" onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}>Select</Button>
          </div>

          {loading ? (
            <p className="text-[var(--muted)] py-10">Loading…</p>
          ) : mode === "phone" ? (
            <PhoneMatches matches={phoneMatches} digits={digits} onOpen={openDetail} onAdd={() => { setForm((f) => ({ ...f, phone: fmtPhone(digits) })); setCreateOpen(true); }} />
          ) : mode === "search" ? (
            <Grid items={nameMatches} selectMode={selectMode} selected={selected} onToggle={toggleSel} onOpen={openDetail} />
          ) : (
            <>
              {recent.length > 0 && (
                <section className="mb-9">
                  <h2 className="font-serif text-[30px] text-ink mb-4">Seen recently</h2>
                  <div className="grid grid-cols-4 max-[1100px]:grid-cols-3 max-[767px]:grid-cols-2 gap-4">
                    {recent.map((c) => (
                      <button key={c.id} onClick={() => openDetail(c)} className="text-left bg-surface border-[1.5px] border-line-soft rounded-[22px] p-5 hover:border-line active:scale-[.99] transition">
                        <Avatar id={c.id} first={c.firstName} last={c.lastName} size={56} className="mb-3" />
                        <p className="text-[20px] font-semibold text-ink leading-tight truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-[15px] font-medium text-[var(--muted)] mt-0.5 truncate">
                          {c.lastVisitAt ? relDate(c.lastVisitAt) : "New"}
                          {c.lifetimeSpend && c.lifetimeSpend > 0 ? ` · ${formatCurrency(c.lifetimeSpend)}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-[30px] text-ink">Everyone</h2>
                </div>
                <Grid items={showMore ? sorted : sorted.slice(0, 9)} selectMode={selectMode} selected={selected} onToggle={toggleSel} onOpen={openDetail} />
                {!showMore && sorted.length > 9 && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={() => setShowMore(true)}>Show more ({sorted.length - 9})</Button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* RIGHT: phone lookup panel (md+) */}
        <aside className="hidden md:block w-[380px] lg:w-[420px] shrink-0">
          <div className="sticky top-9">
            <Keypad digits={digits} setDigits={setDigits} matchCount={phoneMatches.length} onNew={() => { setForm((f) => ({ ...f, phone: fmtPhone(digits) })); setCreateOpen(true); }} />
          </div>
        </aside>
      </div>

      {/* Mobile phone-lookup sheet */}
      {phoneSheet && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setPhoneSheet(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(12px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <Keypad digits={digits} setDigits={setDigits} matchCount={phoneMatches.length} onNew={() => { setPhoneSheet(false); setForm((f) => ({ ...f, phone: fmtPhone(digits) })); setCreateOpen(true); }} onClose={() => setPhoneSheet(false)} />
          </div>
        </div>
      )}

      {/* Select action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[112px] z-30 flex items-center gap-2 bg-ink text-[var(--panel-ink)] rounded-full px-4 py-2.5 shadow-[0_8px_24px_rgba(60,40,20,.2)] max-[767px]:bottom-[84px]">
          <span className="text-sm font-semibold px-2">{selected.size} selected</span>
          <button onClick={() => setBulkOpen(true)} className="text-sm font-semibold bg-white/15 hover:bg-white/25 rounded-full px-3.5 py-1.5 flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> Add points</button>
          <button onClick={() => { if (confirm(`Delete ${selected.size} customers?`)) bulk("delete"); }} className="text-sm font-semibold bg-white/15 hover:bg-[var(--danger-ink)] rounded-full px-3.5 py-1.5 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      )}

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New customer" className="max-w-[520px]">
        <div className="space-y-4">
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="443 000 0000" inputMode="tel" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          {formError && <p className="text-sm font-medium bg-[var(--danger-bg)] text-[var(--danger-ink)] rounded-xl p-3">{formError}</p>}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleCreate} disabled={saving} size="lg" className="flex-1">{saving ? "Adding…" : "Add customer"}</Button>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk points */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Add points to ${selected.size}`} className="max-w-[420px]">
        <div className="space-y-4">
          <Field label="Points to add (each)"><Input type="number" value={bulkPoints} onChange={(e) => setBulkPoints(e.target.value)} placeholder="100" /></Field>
          <Button size="lg" className="w-full" onClick={async () => { if (await bulk("addPoints", bulkPoints)) { setBulkOpen(false); setBulkPoints(""); } }}>Add points</Button>
        </div>
      </Modal>

      {/* Detail sheet */}
      {detail && <DetailSheet c={detail} onClose={() => setDetail(null)} onChanged={load} onGivePoints={() => { setSelected(new Set([detail.id])); setBulkOpen(true); setDetail(null); }} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-semibold text-ink mb-1.5">{label}</label>{children}</div>;
}

function Grid({ items, selectMode, selected, onToggle, onOpen }: { items: Customer[]; selectMode: boolean; selected: Set<string>; onToggle: (id: string) => void; onOpen: (c: Customer) => void; }) {
  if (items.length === 0)
    return <div className="rounded-[22px] border-[1.5px] border-dashed border-[#cdbfa8] p-8 text-center text-[var(--muted)]">No customers to show.</div>;
  return (
    <div className="grid grid-cols-3 max-[1100px]:grid-cols-2 max-[767px]:grid-cols-1 gap-3">
      {items.map((c) => {
        const secondary = c.email || c.phone;
        const sel = selected.has(c.id);
        return (
          <button
            key={c.id}
            onClick={() => (selectMode ? onToggle(c.id) : onOpen(c))}
            className={`flex items-center gap-3 h-[76px] px-4 rounded-[18px] border-[1.5px] bg-surface text-left active:scale-[.99] transition ${sel ? "border-accent ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]" : "border-line-soft hover:border-line"}`}
          >
            {selectMode && <span className={`h-5 w-5 rounded-md border-[1.5px] flex items-center justify-center shrink-0 ${sel ? "bg-accent border-accent" : "border-line"}`}>{sel && <Check className="h-3.5 w-3.5 text-white" />}</span>}
            <Avatar id={c.id} first={c.firstName} last={c.lastName} size={46} />
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold text-ink truncate">{c.firstName} {c.lastName}</span>
              {secondary ? <span className="block text-[14px] font-medium text-[var(--muted)] truncate">{secondary}</span> : <Tag>No contact yet</Tag>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PhoneMatches({ matches, digits, onOpen, onAdd }: { matches: Customer[]; digits: string; onOpen: (c: Customer) => void; onAdd: () => void; }) {
  return (
    <section>
      <h2 className="font-serif text-[32px] text-ink mb-4">Phone contains {fmtPhone(digits)}</h2>
      {matches.length === 0 ? (
        <div className="rounded-[22px] border-[1.5px] border-dashed border-[#cdbfa8] p-7 text-center">
          <p className="text-[17px] text-ink mb-4">No one has that number yet. Add them as a new customer?</p>
          <Button size="lg" onClick={onAdd}><Plus className="h-5 w-5 mr-1" /> Add customer</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((c) => (
            <div key={c.id} className="flex items-center gap-5 bg-surface border-[1.5px] border-line-soft rounded-[22px] p-[18px_20px]">
              <button onClick={() => onOpen(c)} className="flex items-center gap-5 flex-1 min-w-0 text-left">
                <Avatar id={c.id} first={c.firstName} last={c.lastName} size={64} />
                <span className="min-w-0">
                  <span className="block text-[24px] font-semibold text-ink leading-tight truncate">{c.firstName} {c.lastName}</span>
                  <span className="block text-[17px] font-medium text-[var(--muted)] truncate">{c.phone}{visitsLabel(c) ? ` · ${visitsLabel(c)}` : ""}</span>
                </span>
              </button>
              <Link href={`/pos?customerId=${c.id}`}><Button size="lg" className="shrink-0">Start sale</Button></Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Keypad({ digits, setDigits, matchCount, onNew, onClose }: { digits: string; setDigits: (fn: any) => void; matchCount: number; onNew: () => void; onClose?: () => void; }) {
  const press = (d: string) => setDigits((p: string) => (p.length >= 10 ? p : p + d));
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="bg-panel text-[var(--panel-ink)] rounded-[28px] p-[32px] max-[767px]:p-6 flex flex-col gap-[18px]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-serif text-[34px] leading-none">Phone lookup</h3>
          <p className="text-[15px] font-medium text-[var(--panel-muted)] mt-1.5">Ask for any part of their number</p>
        </div>
        {onClose && <button onClick={onClose} className="p-2 -mr-1"><X className="h-6 w-6 text-[var(--panel-muted)]" /></button>}
      </div>
      <div className="h-20 rounded-[20px] bg-[var(--panel-key)] px-6 flex items-center justify-between">
        <span className="text-[34px] font-semibold tracking-[.06em] text-[var(--panel-ink)]">{digits ? fmtPhone(digits) : "···"}</span>
        <span className="text-[15px] font-medium text-[var(--panel-muted)]">{digits.length >= 2 ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : ""}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)} aria-label={k} className="h-[74px] rounded-[18px] bg-[var(--panel-key)] hover:bg-[#443b30] active:scale-[.98] transition text-[28px] font-semibold">{k}</button>
        ))}
        <button onClick={() => setDigits("")} aria-label="Clear all digits" className="h-[74px] rounded-[18px] bg-[var(--panel-key)] hover:bg-[#443b30] active:scale-[.98] transition text-[17px] font-semibold">Clear</button>
        <button onClick={() => press("0")} aria-label="0" className="h-[74px] rounded-[18px] bg-[var(--panel-key)] hover:bg-[#443b30] active:scale-[.98] transition text-[28px] font-semibold">0</button>
        <button onClick={() => setDigits((p: string) => p.slice(0, -1))} aria-label="Delete last digit" className="h-[74px] rounded-[18px] bg-[var(--panel-key)] hover:bg-[#443b30] active:scale-[.98] transition flex items-center justify-center"><Delete className="h-6 w-6" /></button>
      </div>
      <button onClick={onNew} className="h-[60px] rounded-full border-[1.5px] border-[var(--panel-line)] text-[var(--panel-ink)] text-[17px] font-semibold hover:bg-[var(--panel-key)] active:scale-[.98] transition flex items-center justify-center gap-2"><Plus className="h-5 w-5" /> New customer</button>
    </div>
  );
}

function DetailSheet({ c, onClose, onChanged, onGivePoints }: { c: Detail; onClose: () => void; onChanged: () => void; onGivePoints: () => void; }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ firstName: c.firstName, lastName: c.lastName, email: c.email || "", phone: c.phone || "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/customers/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setSaving(false); setEdit(false); onChanged(); onClose();
  };
  const del = async () => { if (!confirm("Delete this customer?")) return; await fetch(`/api/customers/${c.id}`, { method: "DELETE" }); onChanged(); onClose(); };

  const stats = [
    c.visits && c.visits > 0 ? { v: String(c.visits), l: "Visits" } : null,
    c.lifetimeSpend && c.lifetimeSpend > 0 ? { v: formatCurrency(c.lifetimeSpend), l: "Lifetime spend" } : null,
    c.lastVisitAt ? { v: relDate(c.lastVisitAt), l: "Last visit" } : null,
  ].filter(Boolean) as { v: string; l: string }[];

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 animate-in fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-[480px] max-w-full bg-surface border-l-[1.5px] border-line overflow-y-auto animate-in slide-in-from-right-4 p-7">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <Avatar id={c.id} first={c.firstName} last={c.lastName} size={72} />
            <div>
              <h2 className="font-serif text-[34px] leading-none text-ink">{c.firstName} {c.lastName}</h2>
              <p className="text-[14px] font-medium text-[var(--muted)] mt-1.5">Customer since {new Date(c.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-chip"><X className="h-5 w-5 text-[var(--muted)]" /></button>
        </div>

        {/* Contact */}
        <div className="space-y-2 mb-6">
          {edit ? (
            <>
              <div className="grid grid-cols-2 gap-2"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="First" /><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} placeholder="Last" /></div>
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Add phone" />
              <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Add email" />
            </>
          ) : (
            <>
              {c.phone ? <Row label="Phone" value={c.phone} /> : <DashedAdd label="phone" onClick={() => setEdit(true)} />}
              {c.email ? <Row label="Email" value={c.email} /> : <DashedAdd label="email" onClick={() => setEdit(true)} />}
            </>
          )}
        </div>

        {/* Stats */}
        {stats.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {stats.map((s) => (
              <div key={s.l} className="bg-paper rounded-2xl p-4 text-center">
                <p className="text-[24px] font-semibold text-ink leading-none">{s.v}</p>
                <p className="text-[13px] font-medium text-[var(--muted)] mt-1.5">{s.l}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--muted)] mb-6">No purchases yet</p>
        )}

        {/* Points */}
        <div className="flex items-center justify-between bg-paper rounded-2xl p-4 mb-6">
          <p className="text-[15px] font-medium text-ink">{c.points > 0 ? <>{c.points} points · worth {formatCurrency(c.points / 100)} at checkout</> : <span className="text-[var(--muted)]">No points yet</span>}</p>
          <Button variant="outline" size="sm" onClick={onGivePoints}>Give points</Button>
        </div>

        {/* Recent purchases */}
        {c.recentPurchases && c.recentPurchases.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[15px] font-semibold text-ink mb-2">Recent purchases</h3>
            <div className="space-y-2">
              {c.recentPurchases.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[14px]">
                  <span className="min-w-0"><span className="font-medium text-ink truncate block">{p.title}</span>{p.consignorName && <span className="text-[var(--muted)]">from {p.consignorName}</span>}</span>
                  <span className="font-semibold text-ink shrink-0 ml-3">{formatCurrency(p.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          {edit ? (
            <div className="flex gap-2"><Button size="lg" className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button><Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button></div>
          ) : (
            <>
              <Link href={`/pos?customerId=${c.id}`}><Button size="lg" className="w-full">Start sale with {c.firstName}</Button></Link>
              <Button variant="outline" className="w-full" onClick={() => setEdit(true)}>Edit details</Button>
            </>
          )}
          <button onClick={del} className="w-full text-center text-[14px] font-semibold text-[var(--danger-ink)] py-2">Delete customer</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between bg-paper rounded-2xl px-4 h-[52px]"><span className="text-[13px] font-medium text-[var(--muted)]">{label}</span><span className="text-[15px] font-medium text-ink">{value}</span></div>;
}
function DashedAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full flex items-center h-[52px] px-4 rounded-2xl border-[1.5px] border-dashed border-[#cdbfa8] text-[15px] font-medium text-[var(--muted)] hover:text-ink">+ Add {label}</button>;
}
