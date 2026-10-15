"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Shirt, Clock, Trash2 } from "lucide-react";

const PEOPLE_TABS = [
  { label: "Customers", href: "/customers" },
  { label: "Consignors", href: "/consignors" },
  { label: "Appointments", href: "/appointments" },
  { label: "Layaway", href: "/layaway" },
  { label: "Borrowed", href: "/borrowed" },
  { label: "Sip & Shop", href: "/sip-shop" },
];

interface Borrowed {
  id: string; borrowerName: string; phone?: string; email?: string; idNumber?: string;
  dateBorrowed: string; returnDate?: string; items: string;
  conditionPickup?: string; conditionDropoff?: string; dryCleaning?: string; status: string;
}

const todayLocal = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fmtDay = (d?: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

const blankForm = () => ({
  id: "", borrowerName: "", phone: "", email: "", idNumber: "",
  dateBorrowed: todayLocal(), returnDate: "",
  items: "", conditionPickup: "", conditionDropoff: "", dryCleaning: "", status: "OUT",
});

export default function BorrowedPage() {
  const [rows, setRows] = useState<Borrowed[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/borrowed");
    const data = await res.json();
    setRows(data.borrowed || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setError(""); setForm(blankForm()); };
  const openEdit = (b: Borrowed) => {
    setError("");
    setForm({
      id: b.id, borrowerName: b.borrowerName, phone: b.phone || "", email: b.email || "", idNumber: b.idNumber || "",
      dateBorrowed: b.dateBorrowed.slice(0, 10), returnDate: b.returnDate ? b.returnDate.slice(0, 10) : "",
      items: b.items, conditionPickup: b.conditionPickup || "", conditionDropoff: b.conditionDropoff || "", dryCleaning: b.dryCleaning || "", status: b.status,
    });
  };

  const save = async () => {
    if (!form.borrowerName.trim()) { setError("Borrower name is required"); return; }
    if (!form.items.trim()) { setError("Please list the item(s)"); return; }
    setSaving(true); setError("");
    const payload = { ...form };
    const res = form.id
      ? await fetch(`/api/borrowed/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/borrowed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Couldn't save"); return; }
    setForm(null); load();
  };

  const remove = async () => {
    if (!form?.id) return;
    if (!confirm("Delete this record?")) return;
    await fetch(`/api/borrowed/${form.id}`, { method: "DELETE" });
    setForm(null); load();
  };

  const out = rows.filter((r) => r.status === "OUT");

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={PEOPLE_TABS} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Borrowed</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">{out.length} currently out</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> New Agreement</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center"><Shirt className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Currently out</p><p className="text-2xl font-bold text-gray-900">{out.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center"><Clock className="h-5 w-5 text-indigo-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Total</p><p className="text-2xl font-bold text-gray-900">{rows.length}</p></div></CardContent></Card>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading…</div>
        : rows.length === 0 ? (
          <div className="p-12 text-center"><Shirt className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No borrowed items yet</p><p className="text-sm text-gray-400 mt-1">Click “New Agreement” to add one</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Borrower</th>
                <th className="text-left p-4 font-medium text-gray-600">Item(s)</th>
                <th className="text-left p-4 font-medium text-gray-600">Borrowed</th>
                <th className="text-left p-4 font-medium text-gray-600">Return by</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 align-top">
                  <td className="p-4"><p className="font-medium text-gray-900">{b.borrowerName}</p>{b.email && <p className="text-xs text-gray-500">{b.email}</p>}{b.phone && <p className="text-xs text-gray-500">{b.phone}</p>}</td>
                  <td className="p-4 text-gray-700 max-w-[240px]"><p className="line-clamp-2 whitespace-pre-wrap">{b.items}</p></td>
                  <td className="p-4 text-gray-500 text-xs">{fmtDay(b.dateBorrowed)}</td>
                  <td className="p-4 text-gray-700 text-xs">{fmtDay(b.returnDate)}</td>
                  <td className="p-4"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status === "RETURNED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{b.status === "RETURNED" ? "Returned" : "Out"}</span></td>
                  <td className="p-4 text-right"><button onClick={() => openEdit(b)} className="text-indigo-600 hover:text-indigo-800"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal open={!!form} onClose={() => setForm(null)} title={form.id ? "Edit Borrowed Agreement" : "New Borrowed Agreement"} className="max-w-xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Borrower name</label><Input value={form.borrowerName} onChange={(e) => setForm({ ...form, borrowerName: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">ID / Driver’s License #</label><Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="For the agreement email" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Date borrowed</label><Input type="date" value={form.dateBorrowed} onChange={(e) => setForm({ ...form, dateBorrowed: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Return date</label><Input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Item(s) borrowed</label>
              <textarea value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} rows={4} placeholder="One per line — Designer/Brand, Size, Initials, Condition & Tag" className="w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:outline-none focus:border-accent resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Condition at pickup</label><Input value={form.conditionPickup} onChange={(e) => setForm({ ...form, conditionPickup: e.target.value })} placeholder="Optional" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Condition at drop-off</label><Input value={form.conditionDropoff} onChange={(e) => setForm({ ...form, conditionDropoff: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Dry cleaning</label>
                <select value={form.dryCleaning} onChange={(e) => setForm({ ...form, dryCleaning: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3 text-[15px] text-ink focus:outline-none focus:border-accent">
                  <option value="">—</option>
                  <option value="BORROWER">Borrower IS responsible</option>
                  <option value="NOT_BORROWER">Borrower is NOT responsible</option>
                  <option value="UPON_RETURN">Determined upon return</option>
                </select>
              </div>
              {form.id && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3 text-[15px] text-ink focus:outline-none focus:border-accent">
                    <option value="OUT">Out</option><option value="RETURNED">Returned</option>
                  </select>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving…" : form.id ? "Save changes" : "Create & email agreement"}</Button>
              {form.id && <Button variant="outline" onClick={remove} className="gap-1.5 text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /> Delete</Button>}
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
