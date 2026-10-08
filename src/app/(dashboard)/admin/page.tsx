"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Pencil, Users, Clock, DollarSign, Trash2 } from "lucide-react";

const ADMIN_TABS = [
  { label: "Items", href: "/inventory" },
  { label: "Contracts", href: "/contracts" },
  { label: "Admin", href: "/admin" },
];

interface WorkLog {
  id: string;
  employeeName: string;
  phone?: string;
  date: string;
  hours: number;
  payout: number;
  note?: string;
}

// yyyy-mm-dd for <input type="date">
const toDateInput = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

const blankForm = () => ({
  id: "",
  employeeName: "",
  phone: "",
  date: toDateInput(new Date()),
  hours: "",
  payout: "",
  note: "",
});

export default function AdminPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null); // null = modal closed
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/worklogs");
    const data = await res.json();
    setLogs(data.workLogs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setError(""); setForm(blankForm()); };
  const openEdit = (l: WorkLog) => {
    setError("");
    setForm({ id: l.id, employeeName: l.employeeName, phone: l.phone || "", date: toDateInput(l.date), hours: String(l.hours), payout: String(l.payout), note: l.note || "" });
  };

  const save = async () => {
    if (!form.employeeName.trim()) { setError("Employee name is required"); return; }
    setSaving(true); setError("");
    const payload = {
      employeeName: form.employeeName,
      phone: form.phone,
      date: form.date,
      hours: form.hours,
      payout: form.payout,
      note: form.note,
    };
    const res = form.id
      ? await fetch(`/api/worklogs/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/worklogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || "Couldn't save"); return; }
    setForm(null);
    load();
  };

  const remove = async () => {
    if (!form?.id) return;
    if (!confirm("Delete this entry?")) return;
    setSaving(true);
    await fetch(`/api/worklogs/${form.id}`, { method: "DELETE" });
    setSaving(false);
    setForm(null);
    load();
  };

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const totalPayout = logs.reduce((s, l) => s + l.payout, 0);
  const employees = new Set(logs.map((l) => l.employeeName.trim().toLowerCase())).size;

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={ADMIN_TABS} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Admin</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">
            Employee work hours &amp; payouts
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{employees}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Total Payout</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPayout)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No entries yet</p>
            <p className="text-sm text-gray-400 mt-1">Click “Add” to log an employee’s hours and payout</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Date</th>
                <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                <th className="text-left p-4 font-medium text-gray-600">Phone</th>
                <th className="text-right p-4 font-medium text-gray-600">Work Hours</th>
                <th className="text-right p-4 font-medium text-gray-600">Payout</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-700">{formatDate(l.date)}</td>
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{l.employeeName}</p>
                    {l.note && <p className="text-xs text-gray-500">{l.note}</p>}
                  </td>
                  <td className="p-4 text-gray-700">
                    {l.phone ? <a href={`tel:${l.phone}`} className="hover:text-indigo-600">{l.phone}</a> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-4 text-right text-gray-900">{l.hours.toFixed(2)}</td>
                  <td className="p-4 text-right font-medium text-gray-900">{formatCurrency(l.payout)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(l)} className="text-indigo-600 hover:text-indigo-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / edit modal */}
      {form && (
        <Modal open={!!form} onClose={() => setForm(null)} title={form.id ? "Edit Entry" : "Add Entry"} className="max-w-md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee name</label>
              <Input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work hours</label>
                <Input type="number" min={0} step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payout ($)</label>
                <Input type="number" min={0} step="0.01" value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving…" : form.id ? "Save changes" : "Add entry"}</Button>
              {form.id && (
                <Button variant="outline" onClick={remove} disabled={saving} className="gap-1.5 text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
