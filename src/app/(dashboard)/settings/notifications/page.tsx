"use client";

import { useEffect, useState } from "react";
import { Bell, Lock, CheckCircle2 } from "lucide-react";

interface Settings {
  notifyStoreOnInboundMessage: boolean;
  notifyConsignorOnStoreReply: boolean;
  notifyAudienceOnNewPost: boolean;
  notifyEmail: string | null;
}

export default function NotificationSettingsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [storeEmail, setStoreEmail] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const sendTest = async () => {
    setTesting(true); setTestResult(null);
    const res = await fetch("/api/notifications/test", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setTesting(false);
    setTestResult(d.ok
      ? { ok: true, text: `Test alert sent to ${d.to}. Check that inbox (and its spam/junk folder).` }
      : { ok: false, text: `Couldn't send${d.to ? ` to ${d.to}` : ""}: ${d.error || "unknown error"}` });
  };

  useEffect(() => {
    fetch("/api/notifications").then((r) => {
      if (r.status === 401 || r.status === 403) { setAllowed(false); return null; }
      setAllowed(true); return r.json();
    }).then((d) => { if (d) { setS(d.settings); setStoreEmail(d.storeEmail); } });
  }, []);

  const save = async (next: Settings) => {
    setS(next); setSaving(true); setSaved(false);
    const res = await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Owner & manager only</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">Notification settings are managed by owners and managers.</p>
        </div>
      </div>
    );
  }
  if (!s) return <div className="px-11 pt-9 text-[15px] text-[var(--muted)]">Loading…</div>;

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className={`relative h-7 w-12 rounded-full transition-colors shrink-0 ${on ? "bg-accent" : "bg-line"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div>
        <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><Bell className="h-7 w-7 text-accent" /> Notifications</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1">Choose which events also send an email. Email nudges prompt people to log in — they never include the message text.</p>
      </div>

      <div className="rounded-3xl border-[1.5px] border-line bg-surface p-5 max-w-2xl">
        <div className="flex items-start justify-between gap-4 py-4 border-b border-line-soft">
          <div><div className="font-semibold text-[15.5px] text-ink">A customer or consignor messages the store</div><div className="text-[13.5px] text-[var(--muted)] mt-0.5 leading-snug">Email the store so you don't miss it. At most one email per conversation every few minutes.</div></div>
          <Toggle on={s.notifyStoreOnInboundMessage} onToggle={() => save({ ...s, notifyStoreOnInboundMessage: !s.notifyStoreOnInboundMessage })} />
        </div>
        <div className="flex items-start justify-between gap-4 py-4 border-b border-line-soft">
          <div><div className="font-semibold text-[15.5px] text-ink">The store replies to a consignor</div><div className="text-[13.5px] text-[var(--muted)] mt-0.5 leading-snug">Email the consignor a nudge to open their portal and read it.</div></div>
          <Toggle on={s.notifyConsignorOnStoreReply} onToggle={() => save({ ...s, notifyConsignorOnStoreReply: !s.notifyConsignorOnStoreReply })} />
        </div>
        <div className="flex items-start justify-between gap-4 py-4">
          <div><div className="font-semibold text-[15.5px] text-ink">Email the audience when a post is published</div><div className="text-[13.5px] text-[var(--muted)] mt-0.5 leading-snug">Automatically email a content-feed post to its audience. Off by default — use Email Blast for deliberate sends.</div></div>
          <Toggle on={s.notifyAudienceOnNewPost} onToggle={() => save({ ...s, notifyAudienceOnNewPost: !s.notifyAudienceOnNewPost })} />
        </div>
      </div>

      <div className="rounded-3xl border-[1.5px] border-line bg-surface p-5 max-w-2xl">
        <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1.5">Store notification email</label>
        <input
          value={s.notifyEmail ?? ""}
          onChange={(e) => setS({ ...s, notifyEmail: e.target.value })}
          onBlur={() => save(s)}
          placeholder={storeEmail || "where store notifications go"}
          className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink"
        />
        <p className="text-[12.5px] text-[var(--muted)] mt-1.5">Leave blank to use the store email{storeEmail ? ` (${storeEmail})` : ""}.</p>

        <div className="mt-4 pt-4 border-t border-line-soft">
          <p className="text-[14px] text-ink">
            New-message alerts currently go to{" "}
            <b>{(s.notifyEmail && s.notifyEmail.trim()) || storeEmail || "— no address set —"}</b>
          </p>
          <button onClick={sendTest} disabled={testing} className="mt-2.5 rounded-full border-[1.5px] border-line px-4 py-2 text-[14px] font-semibold text-ink hover:bg-chip disabled:opacity-50">
            {testing ? "Sending…" : "Send a test alert"}
          </button>
          {testResult && (
            <p className={`mt-2.5 text-[13.5px] ${testResult.ok ? "text-green-700" : "text-[var(--danger-ink)]"}`}>{testResult.text}</p>
          )}
          <p className="text-[12.5px] text-[var(--muted)] mt-2">Every alert is also listed under Insights → Reports → email activity, marked sent or failed.</p>
        </div>
      </div>

      {saved && <div className="flex items-center gap-2 text-[14px] text-green-700"><CheckCircle2 className="h-4 w-4" /> Saved</div>}
      {saving && <div className="text-[14px] text-[var(--muted)]">Saving…</div>}
    </div>
  );
}
