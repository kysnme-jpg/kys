"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Package, Search, Plus, Trash2, Pencil, X, Tag,
  LayoutGrid, List, Rows3, ArrowUpDown, ArrowUp, ArrowDown, Check, Globe,
} from "lucide-react";

interface Item {
  id: string;
  title: string;
  sku: string;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  condition?: string | null;
  price: number;
  status: string;
  splitPercent?: number | null;
  listedOnline: boolean;
  createdAt: string;
  consignor?: { id: string; firstName: string; lastName: string } | null;
  category?: { id: string; name: string } | null;
  photoUrls: string[];
}

type View = "cards" | "list" | "compact";
type SortKey = "title" | "brand" | "price" | "consignor" | "createdAt";
const STATUSES = ["ACTIVE", "SOLD", "RETURNED", "EXPIRED"];
const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800", SOLD: "bg-gray-100 text-gray-600",
  RETURNED: "bg-yellow-100 text-yellow-800", EXPIRED: "bg-red-100 text-red-800",
};

export default function InventoryPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkMdOpen, setBulkMdOpen] = useState(false);
  const [bulkMd, setBulkMd] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`/api/items?status=${status}&limit=2000`).then((r) => r.json()).then((d) => {
      setRows(d.items || []); setTotal(d.total || 0); setLoading(false); setSelected(new Set());
    });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((i) =>
      i.title.toLowerCase().includes(q) || (i.brand || "").toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      (i.consignor ? `${i.consignor.firstName} ${i.consignor.lastName}`.toLowerCase().includes(q) : false)
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case "brand": av = (a.brand || "").toLowerCase(); bv = (b.brand || "").toLowerCase(); break;
        case "price": av = a.price; bv = b.price; break;
        case "consignor": av = a.consignor ? a.consignor.lastName.toLowerCase() : ""; bv = b.consignor ? b.consignor.lastName.toLowerCase() : ""; break;
        case "createdAt": av = a.createdAt; bv = b.createdAt; break;
      }
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });
  }, [rows, search, sortKey, sortDir]);

  const totalValue = filtered.reduce((s, i) => s + i.price, 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };
  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> : sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  const clearSel = () => setSelected(new Set());

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/items/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editing.title, brand: editing.brand, size: editing.size, color: editing.color, condition: editing.condition, price: editing.price, status: editing.status, listedOnline: editing.listedOnline }),
    });
    setSaving(false); setEditing(null); load();
  };
  const deleteOne = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); alert(d.error || "Couldn't delete (sold items can't be deleted)"); return; }
    setEditing(null); load();
  };
  const bulk = async (action: string, value?: string) => {
    const res = await fetch("/api/items/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids: [...selected], value }) });
    if (res.ok) { clearSel(); load(); } else { const d = await res.json(); alert(d.error || "Failed"); }
    return res.ok;
  };

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onChange(); }} className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>{checked && <Check className="h-3 w-3 text-white" />}</button>
  );
  const thumb = (i: Item, size: string) => i.photoUrls?.[0]
    ? <img src={i.photoUrls[0]} alt="" className={`${size} rounded object-cover`} />
    : <div className={`${size} rounded bg-gray-100 flex items-center justify-center text-gray-300`}><Package className="h-4 w-4" /></div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{total} {status.toLowerCase()} · {formatCurrency(totalValue)} shown</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white">
            {([["list", List], ["cards", LayoutGrid], ["compact", Rows3]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={`p-1.5 rounded-md ${view === v ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`} title={v}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
          <Link href="/inventory/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Add Item</Button></Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, brand, SKU, consignor..." className="pl-10" />
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-2 rounded-lg text-sm font-medium ${status === s ? "bg-indigo-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{s}</button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2.5 sticky top-2 z-10 shadow-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => setBulkMdOpen(true)} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Markdown %</button>
          <button onClick={() => bulk("listOnline")} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> List online</button>
          <button onClick={() => bulk("unlistOnline")} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5">Unlist</button>
          <button onClick={() => bulk("setStatus", "RETURNED")} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5">Mark Returned</button>
          <button onClick={() => { if (confirm(`Delete ${selected.size} items?`)) bulk("delete"); }} className="text-sm bg-white/20 hover:bg-red-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <button onClick={clearSel} className="hover:bg-white/20 rounded-md p-1"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200"><Package className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No items found</p></div>
      ) : view === "list" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-10"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
                <th className="p-3 w-12" />
                {([["title", "Item"], ["brand", "Brand"], ["consignor", "Consignor"], ["price", "Price"], ["createdAt", "Added"]] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} className="text-left p-3 font-medium text-gray-600"><button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gray-900">{label} <SortIcon k={k} /></button></th>
                ))}
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((i) => (
                <tr key={i.id} className={`hover:bg-gray-50 cursor-pointer ${selected.has(i.id) ? "bg-indigo-50/50" : ""}`} onClick={() => setEditing({ ...i })}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(i.id)} onChange={() => toggleOne(i.id)} /></td>
                  <td className="p-2">{thumb(i, "h-9 w-9")}</td>
                  <td className="p-3"><p className="font-medium text-gray-900">{i.title}</p><p className="text-xs text-gray-400 font-mono">{i.sku}{i.listedOnline && " · online"}</p></td>
                  <td className="p-3 text-gray-600">{i.brand || <span className="text-gray-300">—</span>}</td>
                  <td className="p-3 text-gray-600">{i.consignor ? `${i.consignor.firstName} ${i.consignor.lastName}` : <span className="text-gray-300">store</span>}</td>
                  <td className="p-3 font-semibold text-gray-900">{formatCurrency(i.price)}</td>
                  <td className="p-3 text-gray-500 text-xs">{formatDate(i.createdAt)}</td>
                  <td className="p-3"><Pencil className="h-3.5 w-3.5 text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((i) => (
            <div key={i.id} className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative ${selected.has(i.id) ? "border-indigo-400 ring-1 ring-indigo-200" : "border-gray-200"}`} onClick={() => setEditing({ ...i })}>
              <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(i.id)} onChange={() => toggleOne(i.id)} /></div>
              <div className="aspect-square bg-gray-100">{i.photoUrls?.[0] ? <img src={i.photoUrls[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="h-8 w-8" /></div>}</div>
              <div className="p-3">
                <p className="font-medium text-gray-900 text-sm truncate">{i.title}</p>
                <p className="text-xs text-gray-400 truncate">{i.brand || "—"}{i.size ? ` · ${i.size}` : ""}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-bold text-gray-900">{formatCurrency(i.price)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[i.status]}`}>{i.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map((i) => (
            <div key={i.id} className={`flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm ${selected.has(i.id) ? "bg-indigo-50/50" : ""}`} onClick={() => setEditing({ ...i })}>
              <span onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(i.id)} onChange={() => toggleOne(i.id)} /></span>
              <span className="font-medium text-gray-900 flex-1 truncate">{i.title}</span>
              <span className="text-gray-500 w-32 truncate hidden sm:block">{i.brand || "—"}</span>
              <span className="text-gray-500 w-36 truncate hidden md:block">{i.consignor ? `${i.consignor.firstName} ${i.consignor.lastName}` : "store"}</span>
              <span className="text-gray-900 font-medium w-20 text-right">{formatCurrency(i.price)}</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Item" className="max-w-lg">
          <div className="space-y-4">
            <div className="flex gap-4">
              {thumb(editing, "h-20 w-20")}
              <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Brand</label><Input value={editing.brand || ""} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Size</label><Input value={editing.size || ""} onChange={(e) => setEditing({ ...editing, size: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Condition</label><Input value={editing.condition || ""} onChange={(e) => setEditing({ ...editing, condition: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Price</label><Input type="number" min={0} step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={editing.listedOnline} onChange={(e) => setEditing({ ...editing, listedOnline: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Listed on public online shop</label>
            {editing.consignor && <p className="text-xs text-gray-500">Consignor: <b className="text-gray-900">{editing.consignor.firstName} {editing.consignor.lastName}</b></p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={saveEdit} disabled={saving} className="flex-1">{saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={() => deleteOne(editing.id)} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={bulkMdOpen} onClose={() => setBulkMdOpen(false)} title={`Mark down ${selected.size} items`} className="max-w-sm">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Reduce price by (%)</label><Input type="number" min={0} max={100} value={bulkMd} onChange={(e) => setBulkMd(e.target.value)} placeholder="e.g. 25" /></div>
          <div className="flex gap-3"><Button className="flex-1" onClick={async () => { if (await bulk("markdownPercent", bulkMd)) { setBulkMdOpen(false); setBulkMd(""); } }}>Apply markdown</Button><Button variant="outline" onClick={() => setBulkMdOpen(false)}>Cancel</Button></div>
        </div>
      </Modal>
    </div>
  );
}
