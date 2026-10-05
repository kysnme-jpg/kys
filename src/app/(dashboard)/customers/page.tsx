"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import {
  Users, Search, Star, Plus, Mail, Phone, Trash2, Pencil, X,
  LayoutGrid, List, Rows3, ArrowUpDown, ArrowUp, ArrowDown, Check,
} from "lucide-react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  points: number;
  createdAt: string;
}

type View = "cards" | "list" | "compact";
type SortKey = "name" | "email" | "phone" | "points" | "createdAt";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [editing, setEditing] = useState<Customer | null>(null);
  const [bulkPointsOpen, setBulkPointsOpen] = useState(false);
  const [bulkPoints, setBulkPoints] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/customers").then((r) => r.json()).then((d) => { setCustomers(d.customers || []); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = customers.filter((c) =>
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
        case "phone": av = a.phone || ""; bv = b.phone || ""; break;
        case "points": av = a.points; bv = b.points; break;
        case "createdAt": av = a.createdAt; bv = b.createdAt; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [customers, search, sortKey, sortDir]);

  const totalPoints = customers.reduce((s, c) => s + c.points, 0);
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> :
    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
  const clearSel = () => setSelected(new Set());

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName) { setFormError("First and last name required"); return; }
    setSaving(true); setFormError("");
    const res = await fetch("/api/customers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error || "Failed"); setSaving(false); return; }
    setCreateOpen(false); setForm({ firstName: "", lastName: "", email: "", phone: "" }); setSaving(false); load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/customers/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: editing.firstName, lastName: editing.lastName, email: editing.email, phone: editing.phone, points: editing.points }),
    });
    setSaving(false); setEditing(null); load();
  };
  const deleteOne = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    setEditing(null); load();
  };

  const bulk = async (action: string, value?: string) => {
    const res = await fetch("/api/customers/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: [...selected], value }),
    });
    if (res.ok) { clearSel(); load(); }
    return res.ok;
  };
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} selected customers?`)) return;
    await bulk("delete");
  };

  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </button>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{customers.length} members · {totalPoints.toLocaleString()} points issued</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View switch */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white">
            {([["list", List], ["cards", LayoutGrid], ["compact", Rows3]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={`p-1.5 rounded-md ${view === v ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                title={v}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone..." className="pl-10" />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-2.5 sticky top-2 z-10 shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => setBulkPointsOpen(true)} className="text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" /> Add points
          </button>
          <button onClick={bulkDelete} className="text-sm font-medium bg-white/20 hover:bg-red-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={clearSel} className="hover:bg-white/20 rounded-md p-1"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{search ? "No customers match your search" : "No customers yet"}</p>
        </div>
      ) : view === "list" ? (
        /* ---- LIST (table) ---- */
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-10"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
                {([["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["points", "Points"], ["createdAt", "Added"]] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} className="text-left p-3 font-medium text-gray-600">
                    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gray-900">{label} <SortIcon k={k} /></button>
                  </th>
                ))}
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 cursor-pointer ${selected.has(c.id) ? "bg-indigo-50/50" : ""}`} onClick={() => setEditing({ ...c })}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></td>
                  <td className="p-3 font-medium text-gray-900">{c.firstName} {c.lastName}</td>
                  <td className="p-3 text-gray-600">{c.email || <span className="text-gray-300">—</span>}</td>
                  <td className="p-3 text-gray-600">{c.phone || <span className="text-gray-300">—</span>}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium"><Star className="h-3 w-3" />{c.points}</span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="p-3"><Pencil className="h-3.5 w-3.5 text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "cards" ? (
        /* ---- CARDS ---- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer relative ${selected.has(c.id) ? "border-indigo-400 ring-1 ring-indigo-200" : "border-gray-200"}`} onClick={() => setEditing({ ...c })}>
              <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></div>
              <div className="flex flex-col items-center text-center pt-2">
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-2">
                  {(c.firstName[0] || "") + (c.lastName[0] || "")}
                </div>
                <p className="font-semibold text-gray-900">{c.firstName} {c.lastName}</p>
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium mt-1"><Star className="h-3 w-3" />{c.points} pts</span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" />{c.email || "—"}</p>
                <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" />{c.phone || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ---- COMPACT ---- */
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm ${selected.has(c.id) ? "bg-indigo-50/50" : ""}`} onClick={() => setEditing({ ...c })}>
              <span onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></span>
              <span className="font-medium text-gray-900 w-48 truncate">{c.firstName} {c.lastName}</span>
              <span className="text-gray-500 flex-1 truncate">{c.email || "—"}</span>
              <span className="text-gray-500 w-32 truncate hidden sm:block">{c.phone || "—"}</span>
              <span className="text-xs text-amber-700 font-medium w-16 text-right">{c.points} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Customer" className="max-w-md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{formError}</p>}
          <div className="flex gap-3"><Button onClick={handleCreate} disabled={saving} className="flex-1">{saving ? "Adding..." : "Add Customer"}</Button><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button></div>
        </div>
      </Modal>

      {/* Edit modal */}
      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Customer" className="max-w-md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><Input value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><Input value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Loyalty Points</label><Input type="number" min={0} value={editing.points} onChange={(e) => setEditing({ ...editing, points: parseInt(e.target.value) || 0 })} /></div>
            <div className="flex gap-3 pt-1">
              <Button onClick={saveEdit} disabled={saving} className="flex-1">{saving ? "Saving..." : "Save Changes"}</Button>
              <Button variant="outline" onClick={() => deleteOne(editing.id)} className="text-red-600 hover:bg-red-50 gap-1.5"><Trash2 className="h-4 w-4" /> Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk points modal */}
      <Modal open={bulkPointsOpen} onClose={() => setBulkPointsOpen(false)} title={`Add points to ${selected.size} customers`} className="max-w-sm">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Points to add (each)</label><Input type="number" value={bulkPoints} onChange={(e) => setBulkPoints(e.target.value)} placeholder="e.g. 100" /></div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={async () => { if (await bulk("addPoints", bulkPoints)) { setBulkPointsOpen(false); setBulkPoints(""); } }}>Add Points</Button>
            <Button variant="outline" onClick={() => setBulkPointsOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
