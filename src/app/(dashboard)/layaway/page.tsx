"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, CreditCard, DollarSign, Clock, Trash2 } from "lucide-react";

const PEOPLE_TABS = [
  { label: "Customers", href: "/customers" },
  { label: "Consignors", href: "/consignors" },
  { label: "Appointments", href: "/appointments" },
  { label: "Layaway", href: "/layaway" },
  { label: "Borrowed", href: "/borrowed" },
  { label: "Sip & Shop", href: "/sip-shop" },
];

interface Layaway {
  id: string; buyerName: string; address?: string; cityStateZip?: string; phone?: string; email?: string;
  items: string; totalPrice: number; serviceFee: number;
  deposit: number; payment2: number; payment3: number; finalPayment: number;
  amountPaid: number; startDate: string; status: string;
  reminder15At?: string; reminder30At?: string; reminder45At?: string;
}

const todayLocal = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const blankForm = () => ({
  id: "", buyerName: "", address: "", cityStateZip: "", phone: "", email: "",
  items: "", totalPrice: "", serviceFee: "5",
  deposit: "", payment2: "", payment3: "", finalPayment: "",
  startDate: todayLocal(), amountPaid: "0", status: "ACTIVE", addPayment: "",
});

const statusColor: Record<string, string> = {
  ACTIVE: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

export default function LayawayPage() {
  const [rows, setRows] = useState<Layaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/layaways");
    const data = await res.json();
    setRows(data.layaways || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setError(""); setForm(blankForm()); };
  const openEdit = (l: Layaway) => {
    setError("");
    setForm({
      id: l.id, buyerName: l.buyerName, address: l.address || "", cityStateZip: l.cityStateZip || "", phone: l.phone || "", email: l.email || "",
      items: l.items, totalPrice: String(l.totalPrice), serviceFee: String(l.serviceFee),
      deposit: String(l.deposit), payment2: String(l.payment2), payment3: String(l.payment3), finalPayment: String(l.finalPayment),
      startDate: l.startDate.slice(0, 10), amountPaid: String(l.amountPaid), status: l.status, addPayment: "",
    });
  };

  const save = async () => {
    if (!form.buyerName.trim()) { setError("Buyer name is required"); return; }
    if (!form.items.trim()) { setError("Please list the item(s)"); return; }
    setSaving(true); setError("");
    const payload: any = {
      buyerName: form.buyerName, address: form.address, cityStateZip: form.cityStateZip, phone: form.phone, email: form.email,
      items: form.items, totalPrice: form.totalPrice, serviceFee: form.serviceFee,
      deposit: form.deposit, payment2: form.payment2, payment3: form.payment3, finalPayment: form.finalPayment,
      startDate: form.startDate, status: form.status,
    };
    let res;
    if (form.id) {
      if (form.addPayment && Number(form.addPayment) > 0) payload.addPayment = form.addPayment;
      res = await fetch(`/api/layaways/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      res = await fetch("/api/layaways", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Couldn't save"); return; }
    setForm(null); load();
  };

  const remove = async () => {
    if (!form?.id) return;
    if (!confirm("Delete this layaway?")) return;
    await fetch(`/api/layaways/${form.id}`, { method: "DELETE" });
    setForm(null); load();
  };

  const active = rows.filter((r) => r.status === "ACTIVE");
  const totalOwed = active.reduce((s, r) => s + Math.max(0, r.totalPrice - r.amountPaid), 0);

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={PEOPLE_TABS} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Layaway</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">{active.length} active · {formatCurrency(totalOwed)} outstanding</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> New Layaway</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center"><CreditCard className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Active</p><p className="text-2xl font-bold text-gray-900">{active.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Outstanding</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOwed)}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center"><Clock className="h-5 w-5 text-indigo-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Total</p><p className="text-2xl font-bold text-gray-900">{rows.length}</p></div></CardContent></Card>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading…</div>
        : rows.length === 0 ? (
          <div className="p-12 text-center"><CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No layaways yet</p><p className="text-sm text-gray-400 mt-1">Click “New Layaway” to start one</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Buyer</th>
                <th className="text-left p-4 font-medium text-gray-600">Item(s)</th>
                <th className="text-left p-4 font-medium text-gray-600">Started</th>
                <th className="text-right p-4 font-medium text-gray-600">Total</th>
                <th className="text-right p-4 font-medium text-gray-600">Paid</th>
                <th className="text-right p-4 font-medium text-gray-600">Balance</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((l) => {
                const bal = Math.max(0, l.totalPrice - l.amountPaid);
                return (
                  <tr key={l.id} className="hover:bg-gray-50 align-top">
                    <td className="p-4"><p className="font-medium text-gray-900">{l.buyerName}</p>{l.email && <p className="text-xs text-gray-500">{l.email}</p>}{l.phone && <p className="text-xs text-gray-500">{l.phone}</p>}</td>
                    <td className="p-4 text-gray-700 max-w-[220px]"><p className="line-clamp-2">{l.items}</p></td>
                    <td className="p-4 text-gray-500 text-xs">{fmtDay(l.startDate)}</td>
                    <td className="p-4 text-right text-gray-900">{formatCurrency(l.totalPrice)}</td>
                    <td className="p-4 text-right text-gray-900">{formatCurrency(l.amountPaid)}</td>
                    <td className="p-4 text-right font-semibold text-gray-900">{formatCurrency(bal)}</td>
                    <td className="p-4"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[l.status]}`}>{l.status}</span></td>
                    <td className="p-4 text-right"><button onClick={() => openEdit(l)} className="text-indigo-600 hover:text-indigo-800"><Pencil className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal open={!!form} onClose={() => setForm(null)} title={form.id ? "Edit Layaway" : "New Layaway"} className="max-w-xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Buyer name</label><Input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Start date</label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="For agreement & reminders" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">City / State / Zip</label><Input value={form.cityStateZip} onChange={(e) => setForm({ ...form, cityStateZip: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Item(s) & description</label>
              <textarea value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} rows={2} className="w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:outline-none focus:border-accent resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Total price ($)</label><Input type="number" min={0} step="0.01" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Layaway fee ($)</label><Input type="number" min={0} step="0.01" value={form.serviceFee} onChange={(e) => setForm({ ...form, serviceFee: e.target.value })} /></div>
            </div>
            <div className="rounded-xl bg-[var(--panel)] p-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Payment schedule</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="block text-[11px] text-gray-500 mb-1">Deposit (today)</label><Input type="number" min={0} step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">Day 15</label><Input type="number" min={0} step="0.01" value={form.payment2} onChange={(e) => setForm({ ...form, payment2: e.target.value })} /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">Day 30</label><Input type="number" min={0} step="0.01" value={form.payment3} onChange={(e) => setForm({ ...form, payment3: e.target.value })} /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">Day 45 (final)</label><Input type="number" min={0} step="0.01" value={form.finalPayment} onChange={(e) => setForm({ ...form, finalPayment: e.target.value })} /></div>
              </div>
            </div>

            {form.id && (
              <div className="rounded-xl border border-accent/20 bg-accent/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Paid so far</span><span className="font-semibold">{formatCurrency(Number(form.amountPaid) || 0)}</span></div>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><label className="block text-[11px] text-gray-500 mb-1">Record a payment ($)</label><Input type="number" min={0} step="0.01" value={form.addPayment} onChange={(e) => setForm({ ...form, addPayment: e.target.value })} placeholder="0.00" /></div>
                  <div className="w-40"><label className="block text-[11px] text-gray-500 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3 text-[15px] text-ink focus:outline-none focus:border-accent">
                      <option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

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
