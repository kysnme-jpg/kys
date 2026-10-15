"use client";

import { useState, useEffect } from "react";
import { Wine, Check, Clock, MapPin, Sparkles } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const prettyDate = (key: string) => {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

export default function SipAndShopPage() {
  const [store, setStore] = useState<{ name: string; address?: string } | null>(null);
  const [form, setForm] = useState({ hostName: "", phone: "", email: "", guests: "", eventDate: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/sip-and-shop").then((r) => r.json()).then((d) => setStore(d.store || null)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!form.hostName.trim()) { setError("Please enter your name"); return; }
    if (!form.eventDate) { setError("Please pick a date"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/sip-and-shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-ink">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 mb-4"><Wine className="h-6 w-6" /></div>
          <p className="text-sm font-semibold tracking-[0.2em] text-pink-600 uppercase">You're invited to host a</p>
          <h1 className="font-serif text-[40px] sm:text-[52px] leading-none mt-1">Sip &amp; Shop</h1>
          <p className="text-[17px] text-[var(--muted)] mt-3">at {store?.name || "Classic Consigns by KYS"}</p>
          <p className="text-[15px] font-medium text-pink-600 mt-1">Shop. Sip. Sustain. Repeat.</p>
          {store?.address && <p className="text-sm text-[var(--muted)] mt-1 inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{store.address}</p>}
        </div>

        {/* Perks */}
        <div className="rounded-2xl bg-[#1a1a1a] text-white p-6 mb-6">
          <p className="text-sm font-semibold text-pink-300 mb-2 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Your Sip &amp; Shop includes</p>
          <ul className="space-y-1.5 text-[15px] text-gray-100 list-disc pl-5">
            <li>Two types of wine &amp; a delicious charcuterie board</li>
            <li>You + up to 15 guests — a fun, fashionable experience made just for you</li>
            <li>Earn <strong>15% of your sales in store credit</strong></li>
          </ul>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-pink-200"><Clock className="h-4 w-4" /> Events run 7:00 PM – 10:00 PM</p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 mb-4"><Check className="h-6 w-6" /></div>
            <h2 className="font-serif text-2xl">Request received! 🥂</h2>
            <p className="text-[var(--muted)] mt-2">{prettyDate(form.eventDate)}<br />7:00 PM – 10:00 PM</p>
            <p className="text-sm text-[var(--muted)] mt-4">We'll be in touch to confirm the details. Can't wait to host you and your guests!</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
            <h2 className="font-serif text-2xl">Pick your date</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred date</label>
                <input type="date" min={todayLocal()} value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="h-12 w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <div className="h-12 w-full rounded-xl border border-line bg-[var(--panel)] px-3.5 flex items-center text-[15px] text-ink">7:00 PM – 10:00 PM</div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">How many guests? <span className="text-gray-400">(up to 15)</span></label>
              <input type="number" min={0} max={15} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} placeholder="e.g. 10" className="h-12 w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} placeholder="Full name" className="h-12 w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" className="h-12 w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(xxx) xxx-xxxx" className="h-12 w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 text-[15px] focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anything we should know? <span className="text-gray-400">(optional)</span></label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Occasion, preferences, questions…" className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[15px] focus:outline-none focus:border-accent resize-y" />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={submit} disabled={submitting} className="w-full h-12 rounded-full bg-accent text-white font-semibold disabled:opacity-60">
              {submitting ? "Sending…" : "Request my Sip & Shop 🍷"}
            </button>
            <p className="text-center text-xs text-[var(--muted)]">We'll confirm your date by email. If you add your email, you'll get a confirmation and a reminder before your event.</p>
          </div>
        )}

        <p className="text-center text-sm font-medium text-pink-600 mt-8">Be fabulous. Be sustainable. Be you. 🤍</p>
      </div>
    </div>
  );
}
