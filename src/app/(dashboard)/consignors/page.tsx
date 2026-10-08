"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  Users, Search, Plus, Trash2, Pencil, X, ExternalLink,
  LayoutGrid, List, Rows3, ArrowUpDown, ArrowUp, ArrowDown, Check, Percent,
} from "lucide-react";

const PEOPLE_TABS = [
  { label: "Customers", href: "/customers" },
  { label: "Consignors", href: "/consignors" },
  { label: "Appointments", href: "/appointments" },
];

interface Consignor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  splitPercent: number;
  balance: number;
  notes?: string | null;
  portalEnabled: boolean;
  payoutMethod?: string | null;
  zelleHandle?: string | null;
  cashAppHandle?: string | null;
  unsoldPreference?: string | null;
  address?: string | null;
  createdAt: string;
  _count?: { items: number };
}

type View = "cards" | "list" | "compact";
type SortKey = "name" | "email" | "split" | "balance" | "items";

export default function ConsignorsPage() {
  const [rows, setRows] = useState<Consignor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Consignor | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkSplitOpen, setBulkSplitOpen] = useState(false);
  const [bulkSplit, setBulkSplit] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/consignors").then((r) => r.json()).then((d) => { setRows(d.consignors || []); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name": av = `${a.lastName} ${a.firstName}`.toLowerCase(); bv = `${b.lastName} ${b.firstName}`.toLowerCase(); break;
        case "email": av = (a.email || "").toLowerCase(); bv = (b.email || "").toLowerCase(); break;
        case "split": av = a.splitPercent; bv = b.splitPercent; break;
        case "balance": av = a.balance; bv = b.balance; break;
        case "items": av = a._count?.items || 0; bv = b._count?.items || 0; break;
      }
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });
  }, [rows, search, sortKey, sortDir]);

  const totalBalance = rows.reduce((s, c) => s + c.balance, 0);
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };
  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> : sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
  const clearSel = () => setSelected(new Set());

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/consignors/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: editing.firstName, lastName: editing.lastName, email: editing.email, phone: editing.phone, splitPercent: editing.splitPercent, notes: editing.notes, portalEnabled: editing.portalEnabled, payoutMethod: editing.payoutMethod || null, zelleHandle: editing.zelleHandle || null, cashAppHandle: editing.cashAppHandle || null, unsoldPreference: editing.unsoldPreference || null }),
    });
    setSaving(false); setEditing(null); load();
  };
  const deleteOne = async (id: string) => {
    if (!confirm("Delete this consignor? (Only works if they have no items/payouts.)")) return;
    const res = await fetch(`/api/consignors/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); alert(d.error || "Couldn't delete"); return; }
    setEditing(null); load();
  };
  const bulk = async (action: string, value?: string) => {
    const res = await fetch("/api/consignors/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids: [...selected], value }) });
    if (res.ok) { clearSel(); load(); } else { const d = await res.json(); alert(d.error || "Failed"); }
    return res.ok;
  };

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onChange(); }} className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>{checked && <Check className="h-3 w-3 text-white" />}</button>
  );

  return (
    <div className="px-11 pt-9 pb-6 space-y-5 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={PEOPLE_TABS} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Consignors</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">{rows.length} consignors · {formatCurrency(totalBalance)} owed</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white">
            {([["list", List], ["cards", LayoutGrid], ["compact", Rows3]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={`p-1.5 rounded-md ${view === v ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`} title={v}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
          <Link href="/consignors/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Add</Button></Link>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone..." className="pl-10" />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2.5 sticky top-2 z-10 shadow-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => setBulkSplitOpen(true)} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Set split</button>
          <button onClick={() => bulk("enablePortal")} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5">Enable portal</button>
          <button onClick={() => bulk("disablePortal")} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5">Disable portal</button>
          <button onClick={() => { if (confirm(`Delete ${selected.size} consignors?`)) bulk("delete"); }} className="text-sm bg-white/20 hover:bg-red-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <button onClick={clearSel} className="hover:bg-white/20 rounded-md p-1"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200"><Users className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No consignors found</p></div>
      ) : view === "list" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-10"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
                {([["name", "Name"], ["email", "Email"], ["split", "Split %"], ["balance", "Balance"], ["items", "Items"]] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} className="text-left p-3 font-medium text-gray-600"><button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gray-900">{label} <SortIcon k={k} /></button></th>
                ))}
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 cursor-pointer ${selected.has(c.id) ? "bg-indigo-50/50" : ""}`} onClick={() => setEditing({ ...c })}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></td>
                  <td className="p-3 font-medium text-gray-900">{c.firstName} {c.lastName}{c.portalEnabled && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">portal</span>}</td>
                  <td className="p-3 text-gray-600">{c.email || <span className="text-gray-300">—</span>}</td>
                  <td className="p-3"><span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">{c.splitPercent}%</span></td>
                  <td className="p-3 font-medium text-gray-900">{formatCurrency(c.balance)}</td>
                  <td className="p-3 text-gray-600">{c._count?.items ?? 0}</td>
                  <td className="p-3"><Pencil className="h-3.5 w-3.5 text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer relative ${selected.has(c.id) ? "border-indigo-400 ring-1 ring-indigo-200" : "border-gray-200"}`} onClick={() => setEditing({ ...c })}>
              <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></div>
              <div className="flex flex-col items-center text-center pt-2">
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-2">{(c.firstName[0] || "") + (c.lastName[0] || "")}</div>
                <p className="font-semibold text-gray-900">{c.firstName} {c.lastName}</p>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium mt-1">{c.splitPercent}% split</span>
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <div><p className="text-gray-400 text-xs">Balance</p><p className="font-semibold text-gray-900">{formatCurrency(c.balance)}</p></div>
                <div className="text-right"><p className="text-gray-400 text-xs">Items</p><p className="font-semibold text-gray-900">{c._count?.items ?? 0}</p></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm ${selected.has(c.id) ? "bg-indigo-50/50" : ""}`} onClick={() => setEditing({ ...c })}>
              <span onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></span>
              <span className="font-medium text-gray-900 w-48 truncate">{c.firstName} {c.lastName}</span>
              <span className="text-gray-500 flex-1 truncate">{c.email || "—"}</span>
              <span className="text-xs text-indigo-700 w-16 text-center">{c.splitPercent}%</span>
              <span className="text-gray-700 font-medium w-20 text-right">{formatCurrency(c.balance)}</span>
              <span className="text-gray-500 w-14 text-right hidden sm:block">{c._count?.items ?? 0} it.</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Consignor" className="max-w-md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><Input value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><Input value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Split %</label><Input type="number" min={0} max={100} value={editing.splitPercent} onChange={(e) => setEditing({ ...editing, splitPercent: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Preferred payout method</label>
              <select value={editing.payoutMethod || ""} onChange={(e) => setEditing({ ...editing, payoutMethod: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                <option value="">Choose…</option><option value="CHECK">Check — mailed to address</option><option value="CASH">Cash — in store</option><option value="ZELLE">Zelle</option><option value="CASHAPP">Cash App</option><option value="ACH">Bank transfer (ACH)</option>
              </select>
            </div>
            {editing.payoutMethod === "ZELLE" && <div><label className="block text-sm font-medium text-gray-700 mb-1">Zelle (phone or email)</label><Input value={editing.zelleHandle || ""} onChange={(e) => setEditing({ ...editing, zelleHandle: e.target.value })} placeholder="443-000-0000 or name@email.com" /></div>}
            {editing.payoutMethod === "CASHAPP" && <div><label className="block text-sm font-medium text-gray-700 mb-1">Cash App $Cashtag</label><Input value={editing.cashAppHandle || ""} onChange={(e) => setEditing({ ...editing, cashAppHandle: e.target.value })} placeholder="$classicconsigns" /></div>}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">If items don&apos;t sell</label>
              <select value={editing.unsoldPreference || ""} onChange={(e) => setEditing({ ...editing, unsoldPreference: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                <option value="">Choose…</option><option value="PICKUP">Pick-up</option><option value="DONATE">Donate</option><option value="CONTINUE">Continue consigning (30 days)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={editing.portalEnabled} onChange={(e) => setEditing({ ...editing, portalEnabled: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Portal access enabled</label>
            <div className="text-xs text-gray-500">Balance: <b className="text-gray-900">{formatCurrency(editing.balance)}</b> · {editing._count?.items ?? 0} items</div>
            <div className="flex gap-2 pt-1 items-center">
              <Button onClick={saveEdit} disabled={saving} className="flex-1">{saving ? "Saving..." : "Save"}</Button>
              <Link href={`/consignors/${editing.id}`}><Button variant="outline" className="gap-1.5"><ExternalLink className="h-4 w-4" /> Details</Button></Link>
              <Button variant="outline" onClick={() => deleteOne(editing.id)} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={bulkSplitOpen} onClose={() => setBulkSplitOpen(false)} title={`Set split for ${selected.size} consignors`} className="max-w-sm">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Split % (consignor's share)</label><Input type="number" min={0} max={100} value={bulkSplit} onChange={(e) => setBulkSplit(e.target.value)} placeholder="e.g. 50" /></div>
          <div className="flex gap-3"><Button className="flex-1" onClick={async () => { if (await bulk("setSplit", bulkSplit)) { setBulkSplitOpen(false); setBulkSplit(""); } }}>Apply</Button><Button variant="outline" onClick={() => setBulkSplitOpen(false)}>Cancel</Button></div>
        </div>
      </Modal>
    </div>
  );
}
