"use client";

import { useState, useEffect } from "react";
import { slotLabel, prettyDate, SLOT_TIMES, MAX_APPTS_PER_DAY } from "@/lib/appointments";
import { CalendarCheck, Check, Clock, MapPin } from "lucide-react";

interface Saturday {
  date: string;
  blocked: boolean;
  blockedReason: string | null;
  bookedSlots: number[];
}

export default function BookPage() {
  const [store, setStore] = useState<{ name: string; address?: string } | null>(null);
  const [saturdays, setSaturdays] = useState<Saturday[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<{ date: string; slot: number } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const load = async () => {
    const res = await fetch("/api/book");
    const data = await res.json();
    setStore(data.store || null);
    setSaturdays(data.saturdays || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!picked) return;
    if (!form.name.trim()) { setError("Please enter your name"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/book", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: picked.date, slot: picked.slot, ...form }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setError(data.error || "Couldn't book. Please try again."); load(); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-ink">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent mb-4">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-[34px] sm:text-[44px] leading-tight">{store?.name || "Classic Consigns by KYS"}</h1>
          <p className="text-[17px] text-[var(--muted)] mt-2">Book a consignment appointment</p>
          {store?.address && (
            <p className="text-sm text-[var(--muted)] mt-1 inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{store.address}</p>
          )}
        </div>

        {/* Rules */}
        <div className="rounded-2xl border border-line bg-surface p-5 mb-8 text-sm text-[var(--muted)] space-y-1.5">
          <p className="flex items-center gap-2 text-ink font-medium"><Clock className="h-4 w-4 text-accent" /> Saturdays only · 12:00–3:00 PM · up to {MAX_APPTS_PER_DAY} appointments per day</p>
          <ul className="list-disc pl-6 space-y-0.5">
            <li>Each appointment is up to 40 minutes.</li>
            <li>First-time consigning: please bring <strong>no more than 10 items</strong>.</li>
            <li>Shoes &amp; jewelry are not counted in the 10 (please don’t bring tons of jewelry).</li>
          </ul>
        </div>

        {done ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 mb-4"><Check className="h-6 w-6" /></div>
            <h2 className="font-serif text-2xl">You’re booked!</h2>
            <p className="text-[var(--muted)] mt-2">
              {picked && <>{prettyDate(picked.date)}<br />{slotLabel(picked.slot)}</>}
            </p>
            <p className="text-sm text-[var(--muted)] mt-4">We look forward to seeing you. If you need to change or cancel, just give us a call.</p>
          </div>
        ) : loading ? (
          <div className="text-center text-[var(--muted)] py-12">Loading available times…</div>
        ) : (
          <div className="space-y-4">
            {saturdays.map((sat) => {
              const full = sat.bookedSlots.length >= SLOT_TIMES.length;
              return (
                <div key={sat.date} className={`rounded-2xl border p-5 ${sat.blocked ? "border-line bg-surface/50 opacity-70" : "border-line bg-surface"}`}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="font-serif text-xl">{prettyDate(sat.date)}</h3>
                    {sat.blocked && <span className="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{sat.blockedReason || "No appointments"}</span>}
                    {!sat.blocked && full && <span className="text-xs font-medium text-[var(--muted)] bg-[var(--panel)] px-2.5 py-1 rounded-full">Fully booked</span>}
                  </div>
                  {!sat.blocked && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SLOT_TIMES.map((_, slot) => {
                        const taken = sat.bookedSlots.includes(slot);
                        const isPicked = picked?.date === sat.date && picked?.slot === slot;
                        return (
                          <button
                            key={slot}
                            disabled={taken}
                            onClick={() => { setPicked({ date: sat.date, slot }); setError(""); }}
                            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                              taken ? "border-line bg-[var(--panel)] text-[var(--muted)] line-through cursor-not-allowed"
                              : isPicked ? "border-accent bg-accent text-white"
                              : "border-line bg-[var(--paper)] hover:border-accent hover:text-accent"
                            }`}
                          >
                            {slotLabel(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Booking form (appears once a slot is picked) */}
        {picked && !done && (
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
            <div className="max-w-3xl mx-auto px-5 py-4 space-y-3">
              <p className="text-sm font-medium text-ink">
                Booking: <span className="text-accent">{prettyDate(picked.date)} · {slotLabel(picked.slot)}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name *" className="h-11 rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="h-11 rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="h-11 rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button onClick={submit} disabled={submitting} className="flex-1 h-11 rounded-full bg-accent text-white font-medium disabled:opacity-60">
                  {submitting ? "Booking…" : "Confirm appointment"}
                </button>
                <button onClick={() => { setPicked(null); setError(""); }} className="h-11 px-5 rounded-full border border-line text-[var(--muted)]">Cancel</button>
              </div>
            </div>
          </div>
        )}
        <div className="h-28" />
      </div>
    </div>
  );
}
