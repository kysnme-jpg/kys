"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { slotLabel, prettyDate, formatTime, SLOT_TIMES } from "@/lib/appointments";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Ban, Undo2, Link2, Clock, Check, UserPlus, Send, CalendarPlus } from "lucide-react";

const PEOPLE_TABS = [
  { label: "Customers", href: "/customers" },
  { label: "Consignors", href: "/consignors" },
  { label: "Appointments", href: "/appointments" },
  { label: "Layaway", href: "/layaway" },
  { label: "Borrowed", href: "/borrowed" },
  { label: "Sip & Shop", href: "/sip-shop" },
];

interface Appt { id: string; slot: number; startTime?: string; name: string; email?: string; phone?: string; note?: string }
interface Saturday { date: string; blocked: boolean; blockedReason: string | null; appointments: Appt[]; extras: Appt[] }
interface OtherDay { date: string; appointments: Appt[] }

const todayLocal = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function AppointmentsPage() {
  const router = useRouter();
  const [saturdays, setSaturdays] = useState<Saturday[]>([]);
  const [otherDays, setOtherDays] = useState<OtherDay[]>([]);
  const [converting, setConverting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addFor, setAddFor] = useState<{ date: string; slot: number } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  // Custom any-day/any-time appointment
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ date: "", time: "", name: "", email: "", phone: "", note: "" });

  const load = async () => {
    const res = await fetch("/api/appointments");
    const data = await res.json();
    setSaturdays(data.saturdays || []);
    setOtherDays(data.otherDays || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // Keep the list fresh so new online bookings show up without a manual reload.
    const poll = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(poll); window.removeEventListener("focus", onFocus); };
  }, []);

  const openAdd = (date: string, slot: number) => { setForm({ name: "", email: "", phone: "", note: "" }); setError(""); setAddFor({ date, slot }); };

  const saveAppt = async () => {
    if (!addFor) return;
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/appointments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: addFor.date, slot: addFor.slot, ...form }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || "Couldn't save"); return; }
    setAddFor(null); load();
  };

  const openCustom = () => { setCustomForm({ date: "", time: "", name: "", email: "", phone: "", note: "" }); setError(""); setCustomOpen(true); };
  const saveCustom = async () => {
    if (!customForm.date) { setError("Pick a date"); return; }
    if (!customForm.time) { setError("Pick a time"); return; }
    if (!customForm.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/appointments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: customForm.date, time: customForm.time, name: customForm.name, email: customForm.email, phone: customForm.phone, note: customForm.note }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || "Couldn't save"); return; }
    setCustomOpen(false); load();
  };

  const cancelAppt = async (id: string) => {
    if (!confirm("Cancel this appointment?")) return;
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    load();
  };

  const convert = async (appt: Appt) => {
    if (!confirm(`Create a consignor record for “${appt.name}” and remove this appointment?`)) return;
    setConverting(appt.id);
    const res = await fetch(`/api/appointments/${appt.id}/convert`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setConverting(null);
    if (!res.ok) { alert(data.error || "Couldn't convert"); return; }
    // Jump straight to the new (or matched) consignor's page.
    router.push(`/consignors/${data.consignorId}`);
  };

  const toggleBlock = async (sat: Saturday) => {
    if (sat.blocked) {
      await fetch("/api/appointments/block", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: sat.date }) });
    } else {
      if (sat.appointments.length && !confirm("This day has appointments. Block it anyway? (Existing appointments stay but no new ones can be booked.)")) return;
      const reason = prompt("Reason (optional), e.g. “Holiday – No Appts”") ?? "";
      await fetch("/api/appointments/block", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: sat.date, reason }) });
    }
    load();
  };

  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/book` : "/book";
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const [testing, setTesting] = useState(false);
  const sendTest = async () => {
    const to = prompt("Send a test email to which address?", "");
    if (to === null) return; // cancelled
    setTesting(true);
    let d: any = {};
    let status = 0;
    try {
      const res = await fetch("/api/appointments/test-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
      status = res.status;
      d = await res.json().catch(() => ({}));
    } catch (e: any) {
      d = { error: e?.message || "request failed" };
    }
    setTesting(false);
    if (d.ok) {
      alert(`✅ Test email sent to ${d.to} from ${d.from}.\n\nCheck the inbox (and spam). Resend id: ${d.id || "—"}`);
    } else if (status === 404) {
      alert(`⚠️ The test-email feature isn't deployed yet (HTTP 404).\n\nWait for the latest Railway deploy to finish (Deployments tab → “Deployment successful”), then try again.`);
    } else {
      alert(`❌ Email failed (HTTP ${status || "?"}).\n\nFrom: ${d.from || "—"}\nAPI key present on server: ${d.hasKey === true ? "yes" : d.hasKey === false ? "NO" : "unknown"}\n\nError: ${d.error || "unknown"}`);
    }
  };

  const totalBooked = saturdays.reduce((s, d) => s + d.appointments.length + d.extras.length, 0)
    + otherDays.reduce((s, d) => s + d.appointments.length, 0);

  // Reusable card for a single appointment (used for extras and other-day lists).
  const apptBlock = (appt: Appt) => (
    <div key={appt.id} className="rounded-lg border border-gray-200 p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-accent mb-0.5">{appt.startTime ? formatTime(appt.startTime) : slotLabel(appt.slot)}</p>
          <p className="font-medium text-gray-900 text-sm">{appt.name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => convert(appt)} disabled={converting === appt.id} className="text-gray-300 hover:text-accent disabled:opacity-50" title="Convert to consignor"><UserPlus className="h-3.5 w-3.5" /></button>
          <button onClick={() => cancelAppt(appt.id)} className="text-gray-300 hover:text-red-500" title="Cancel"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {appt.phone && <p className="text-xs text-gray-500">{appt.phone}</p>}
      {appt.email && <p className="text-xs text-gray-500 truncate">{appt.email}</p>}
      {appt.note && <p className="text-xs text-gray-400 mt-0.5">{appt.note}</p>}
    </div>
  );

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={PEOPLE_TABS} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Appointments</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">
            Saturdays 12–3 PM · {totalBooked} upcoming booking{totalBooked === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={openCustom} className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            New appointment
          </Button>
          <Button onClick={sendTest} variant="outline" disabled={testing} className="gap-2">
            <Send className="h-4 w-4" />
            {testing ? "Sending…" : "Send test email"}
          </Button>
          <Button onClick={copyLink} variant="outline" className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy booking link"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-[var(--muted)] flex items-center gap-2">
        <Clock className="h-4 w-4 text-accent shrink-0" />
        <span>Share your public booking page: <a href="/book" target="_blank" className="text-accent font-medium underline">{bookingUrl}</a></span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-4">
          {saturdays.map((sat) => {
            const bySlot: Record<number, Appt> = {};
            for (const a of sat.appointments) bySlot[a.slot] = a;
            return (
              <div key={sat.date} className={`rounded-xl border bg-white overflow-hidden ${sat.blocked ? "border-red-200" : "border-gray-200"}`}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg text-ink">{prettyDate(sat.date)}</h3>
                    {sat.blocked && <span className="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{sat.blockedReason || "No appointments"}</span>}
                  </div>
                  <button onClick={() => toggleBlock(sat)} className="text-xs font-medium text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5">
                    {sat.blocked ? <><Undo2 className="h-3.5 w-3.5" /> Unblock day</> : <><Ban className="h-3.5 w-3.5" /> Block day</>}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                  {SLOT_TIMES.map((_, slot) => {
                    const appt = bySlot[slot];
                    return (
                      <div key={slot} className="p-4 min-h-[92px] flex flex-col">
                        <p className="text-xs font-medium text-gray-400 mb-1.5">{slotLabel(slot)}</p>
                        {appt ? (
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-gray-900 text-sm">{appt.name}</p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => convert(appt)} disabled={converting === appt.id} className="text-gray-300 hover:text-accent disabled:opacity-50" title="Convert to consignor"><UserPlus className="h-3.5 w-3.5" /></button>
                                <button onClick={() => cancelAppt(appt.id)} className="text-gray-300 hover:text-red-500" title="Cancel"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                            {appt.phone && <p className="text-xs text-gray-500">{appt.phone}</p>}
                            {appt.email && <p className="text-xs text-gray-500 truncate">{appt.email}</p>}
                            {appt.note && <p className="text-xs text-gray-400 mt-0.5">{appt.note}</p>}
                            <button onClick={() => convert(appt)} disabled={converting === appt.id} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline disabled:opacity-50">
                              <UserPlus className="h-3 w-3" /> {converting === appt.id ? "Converting…" : "Add as consignor"}
                            </button>
                          </div>
                        ) : sat.blocked ? (
                          <p className="text-xs text-gray-300 mt-auto">—</p>
                        ) : (
                          <button onClick={() => openAdd(sat.date, slot)} className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                            <Plus className="h-3.5 w-3.5" /> Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {sat.extras.length > 0 && (
                  <div className="px-4 pb-4 pt-1">
                    <p className="text-xs font-medium text-gray-400 mb-2">Also booked (extra times)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {sat.extras.map((a) => apptBlock(a))}
                    </div>
                  </div>
                )}
                {!sat.blocked && (
                  <div className="px-4 pb-3">
                    <button onClick={() => { setCustomForm({ date: sat.date, time: "", name: "", email: "", phone: "", note: "" }); setError(""); setCustomOpen(true); }} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                      <Plus className="h-3.5 w-3.5" /> Add extra appointment (any time)
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Appointments on other days (Wed/Thu/Fri, custom times) */}
          {otherDays.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <h3 className="font-serif text-lg text-ink">Other appointments</h3>
                <p className="text-xs text-gray-500">Weekday &amp; custom-time appointments outside the Saturday slots</p>
              </div>
              <div className="p-4 space-y-4">
                {otherDays.map((d) => (
                  <div key={d.date}>
                    <p className="text-sm font-medium text-gray-700 mb-2">{prettyDate(d.date)}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {d.appointments.map((a) => apptBlock(a))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add appointment modal */}
      {addFor && (
        <Modal open={!!addFor} onClose={() => setAddFor(null)} title="Add Appointment" className="max-w-md">
          <div className="space-y-4">
            <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3 text-sm">
              <p className="font-medium text-ink">{prettyDate(addFor.date)}</p>
              <p className="text-gray-500">{slotLabel(addFor.slot)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Consignor name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={saveAppt} disabled={saving} className="flex-1">{saving ? "Saving…" : "Add appointment"}</Button>
              <Button variant="outline" onClick={() => setAddFor(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custom any-day / any-time appointment modal */}
      {customOpen && (
        <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="New Appointment" className="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Schedule a consignor on <strong>any day and time</strong> — e.g. a weekday exception. They'll get an email confirmation if you add their email.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <Input type="date" min={todayLocal()} value={customForm.date} onChange={(e) => setCustomForm({ ...customForm, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <Input type="time" value={customForm.time} onChange={(e) => setCustomForm({ ...customForm, time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input value={customForm.name} onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })} placeholder="Consignor name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={customForm.phone} onChange={(e) => setCustomForm({ ...customForm, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input value={customForm.email} onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })} placeholder="For confirmation" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <Input value={customForm.note} onChange={(e) => setCustomForm({ ...customForm, note: e.target.value })} placeholder="Optional" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={saveCustom} disabled={saving} className="flex-1">{saving ? "Saving…" : "Add & email confirmation"}</Button>
              <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
