"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Heart, Gift } from "lucide-react";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SOURCES = ["Walked by / Storefront", "Friend or family", "Instagram", "Facebook", "Google", "Event / Sip & Shop", "Returning customer", "Other"];

const blank = () => ({ firstName: "", lastName: "", email: "", phone: "", bMonth: "", bDay: "", source: "" });

export default function WelcomePage() {
  const [store, setStore] = useState<{ name: string } | null>(null);
  const [form, setForm] = useState(blank());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { returning: boolean; firstName: string }>(null);
  const resetTimer = useRef<any>(null);

  useEffect(() => {
    fetch("/api/checkin").then((r) => r.json()).then((d) => setStore(d.store || null)).catch(() => {});
  }, []);

  const resetAll = () => { setForm(blank()); setError(""); setDone(null); };

  const submit = async () => {
    if (!form.firstName.trim()) { setError("Please enter your first name"); return; }
    if (!form.email.trim() && !form.phone.trim()) { setError("Please add an email or phone number"); return; }
    setSubmitting(true); setError("");
    const birthday = form.bMonth && form.bDay ? `${form.bMonth.padStart(2, "0")}-${form.bDay.padStart(2, "0")}` : "";
    const res = await fetch("/api/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, birthday, source: form.source }),
    });
    const d = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
    setDone({ returning: !!d.returning, firstName: d.firstName || form.firstName });
    // Auto-reset for the next guest.
    resetTimer.current = setTimeout(resetAll, 7000);
  };

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const inputCls = "h-14 w-full rounded-2xl border border-line bg-[var(--paper)] px-4 text-[18px] focus:outline-none focus:border-accent";

  return (
    <div className="min-h-screen bg-[var(--paper)] text-ink flex flex-col">
      <div className="flex-1 w-full max-w-xl mx-auto px-6 py-10 flex flex-col justify-center">
        {done ? (
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700 mb-5"><Check className="h-8 w-8" /></div>
            <h1 className="font-serif text-[40px] leading-tight">{done.returning ? `Welcome back, ${done.firstName}!` : `Welcome, ${done.firstName}!`}</h1>
            <p className="text-[18px] text-[var(--muted)] mt-3">
              {done.returning ? "So glad to see you again. 💕" : "You're on the list! Thanks for joining us. 💕"}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-pink-100 text-pink-700 px-4 py-2 text-sm font-medium">
              <Gift className="h-4 w-4" /> Earn 1 point per $1 · 100 points = $1 off
            </div>
            <div className="mt-8">
              <button onClick={resetAll} className="h-12 px-8 rounded-full bg-accent text-white font-semibold">Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-7">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 mb-3"><Heart className="h-6 w-6" /></div>
              <h1 className="font-serif text-[38px] sm:text-[46px] leading-none">Welcome!</h1>
              <p className="text-[18px] text-[var(--muted)] mt-2">to {store?.name || "Classic Consigns by KYS"}</p>
              <p className="text-[15px] text-[var(--muted)] mt-1">Sign in to join our VIP list &amp; earn rewards</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
                <input className={inputCls} placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
              </div>
              <input className={inputCls} placeholder="Email" type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
              <input className={inputCls} placeholder="Phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 px-1">Birthday <span className="text-gray-400">(optional — for a birthday treat 🎁)</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <select className={inputCls} value={form.bMonth} onChange={(e) => setForm({ ...form, bMonth: e.target.value })}>
                    <option value="">Month</option>
                    {MONTHS.slice(1).map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                  </select>
                  <select className={inputCls} value={form.bDay} onChange={(e) => setForm({ ...form, bDay: e.target.value })}>
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 px-1">How did you hear about us? <span className="text-gray-400">(optional)</span></label>
                <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="">Select…</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {error && <p className="text-[16px] text-red-600 text-center">{error}</p>}
              <button onClick={submit} disabled={submitting} className="w-full h-14 rounded-full bg-accent text-white text-[18px] font-semibold disabled:opacity-60 mt-1">
                {submitting ? "Saving…" : "Join / Check in"}
              </button>
              <p className="text-center text-xs text-[var(--muted)]">We'll only use your info for rewards and store updates. 🤍</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
