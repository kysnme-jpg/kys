"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Wine, Users, Clock, Trash2, ChevronLeft, ChevronRight, Link2, Check } from "lucide-react";

const PEOPLE_TABS = [
  { label: "Customers", href: "/customers" },
  { label: "Consignors", href: "/consignors" },
  { label: "Appointments", href: "/appointments" },
  { label: "Layaway", href: "/layaway" },
  { label: "Borrowed", href: "/borrowed" },
  { label: "Sip & Shop", href: "/sip-shop" },
];

interface SipEvent {
  id: string; hostName: string; phone?: string; email?: string; guests: number;
  eventDate: string; notes?: string; status: string; reminderSentAt?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dayKeyOf = (iso: string) => iso.slice(0, 10);

const blankForm = (date?: string) => ({ id: "", hostName: "", phone: "", email: "", guests: "", eventDate: date || localDayKey(new Date()), notes: "", status: "SCHEDULED" });

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-pink-100 text-pink-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

export default function SipShopPage() {
  const [events, setEvents] = useState<SipEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [copied, setCopied] = useState(false);
  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/sip-and-shop` : "/sip-and-shop";
  const copyLink = async () => { try { await navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };

  const load = async () => {
    const res = await fetch("/api/sipshop");
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = (date?: string) => { setError(""); setForm(blankForm(date)); };
  const openEdit = (e: SipEvent) => {
    setError("");
    setForm({ id: e.id, hostName: e.hostName, phone: e.phone || "", email: e.email || "", guests: String(e.guests || ""), eventDate: dayKeyOf(e.eventDate), notes: e.notes || "", status: e.status });
  };

  const save = async () => {
    if (!form.hostName.trim()) { setError("Host name is required"); return; }
    if (!form.eventDate) { setError("Pick an event date"); return; }
    setSaving(true); setError("");
    const payload = { hostName: form.hostName, phone: form.phone, email: form.email, guests: form.guests, eventDate: form.eventDate, notes: form.notes, status: form.status };
    const res = form.id
      ? await fetch(`/api/sipshop/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/sipshop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Couldn't save"); return; }
    setForm(null); load();
  };

  const remove = async () => {
    if (!form?.id) return;
    if (!confirm("Delete this Sip & Shop event?")) return;
    await fetch(`/api/sipshop/${form.id}`, { method: "DELETE" });
    setForm(null); load();
  };

  // Calendar grid
  const todayKey = localDayKey(new Date());
  const byDay: Record<string, SipEvent[]> = {};
  for (const e of events) { if (e.status !== "CANCELLED") (byDay[dayKeyOf(e.eventDate)] ||= []).push(e); }
  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(d)}` });
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const upcoming = events.filter((e) => e.status === "SCHEDULED");

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={PEOPLE_TABS} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Sip &amp; Shop</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">Host events · 7–10 PM · {upcoming.length} upcoming</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={copyLink} variant="outline" className="gap-2">{copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{copied ? "Link copied" : "Copy booking link"}</Button>
          <Button onClick={() => openAdd()} className="gap-2"><Plus className="h-4 w-4" /> New Event</Button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-[var(--muted)] flex items-center gap-2">
        <Wine className="h-4 w-4 text-pink-500 shrink-0" />
        <span>Customers can request their own Sip &amp; Shop at <a href="/sip-and-shop" target="_blank" className="text-accent font-medium underline">{bookingUrl}</a></span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-pink-50 rounded-lg flex items-center justify-center"><Wine className="h-5 w-5 text-pink-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Upcoming</p><p className="text-2xl font-bold text-gray-900">{upcoming.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center"><Users className="h-5 w-5 text-indigo-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Guests (upcoming)</p><p className="text-2xl font-bold text-gray-900">{upcoming.reduce((s, e) => s + (e.guests || 0), 0)}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-gray-500 uppercase font-medium">Total</p><p className="text-2xl font-bold text-gray-900">{events.length}</p></div></CardContent></Card>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-ink">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="px-3 h-8 rounded-full hover:bg-gray-100 text-sm font-medium text-gray-600">Today</button>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-center text-xs font-medium text-gray-400 uppercase pb-1">{d}</div>)}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`b${i}`} />;
            const evs = byDay[cell.key] || [];
            const isToday = cell.key === todayKey;
            return (
              <button key={cell.key} onClick={() => openAdd(cell.key)} className={`min-h-[72px] rounded-xl border p-1.5 text-left transition-colors flex flex-col gap-1 ${isToday ? "border-accent bg-accent/5" : "border-gray-200 hover:border-accent/50 hover:bg-gray-50"}`} title={`Add a Sip & Shop on ${cell.key}`}>
                <span className={`text-sm font-medium ${isToday ? "text-accent" : "text-gray-700"}`}>{cell.day}</span>
                <span className="mt-auto flex flex-col gap-0.5">
                  {evs.slice(0, 2).map((e) => (
                    <span key={e.id} onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} className="rounded-md bg-pink-100 text-pink-700 text-[11px] font-semibold px-1.5 py-0.5 truncate">🍷 {e.hostName.split(/\s+/)[0]}{e.guests ? ` (${e.guests})` : ""}</span>
                  ))}
                  {evs.length > 2 && <span className="text-[10px] text-gray-400 font-medium pl-0.5">+{evs.length - 2} more</span>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">Tap any day to schedule a Sip &amp; Shop. Tap a name to edit it.</p>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading…</div>
        : events.length === 0 ? (
          <div className="p-12 text-center"><Wine className="h-10 w-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No Sip &amp; Shop events yet</p><p className="text-sm text-gray-400 mt-1">Tap a day on the calendar or “New Event”</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Date</th>
                <th className="text-left p-4 font-medium text-gray-600">Host</th>
                <th className="text-left p-4 font-medium text-gray-600">Contact</th>
                <th className="text-right p-4 font-medium text-gray-600">Guests</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-700">{fmtDay(e.eventDate)}<div className="text-xs text-gray-400">7:00–10:00 PM</div></td>
                  <td className="p-4 font-medium text-gray-900">{e.hostName}</td>
                  <td className="p-4 text-gray-500 text-xs">{e.email && <div>{e.email}</div>}{e.phone && <div>{e.phone}</div>}</td>
                  <td className="p-4 text-right text-gray-900">{e.guests || "—"}</td>
                  <td className="p-4"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[e.status]}`}>{e.status}</span></td>
                  <td className="p-4 text-right"><button onClick={() => openEdit(e)} className="text-indigo-600 hover:text-indigo-800"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal open={!!form} onClose={() => setForm(null)} title={form.id ? "Edit Sip & Shop" : "New Sip & Shop"} className="max-w-md">
          <div className="space-y-4">
            <div className="rounded-xl bg-pink-50 border border-pink-200 px-4 py-2.5 text-sm text-pink-800">🍷 Sip &amp; Shop events run <strong>7:00–10:00 PM</strong>. The host gets a confirmation email (and a reminder before the event) if you add their email.</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Event date</label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1"># of guests</label><Input type="number" min={0} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} placeholder="e.g. 10" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Host name</label><Input value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="For confirmation & reminder" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></div>
            {form.id && (
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3 text-[15px] text-ink focus:outline-none focus:border-accent">
                  <option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving…" : form.id ? "Save changes" : "Create & email host"}</Button>
              {form.id && <Button variant="outline" onClick={remove} className="gap-1.5 text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /> Delete</Button>}
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
