"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, Send, Lock, Eye, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { AudienceSelect, type AudienceValue } from "@/components/audience/audience-select";
import { describeAudience, type AudienceScope } from "@/lib/posts";

interface LogRow { id: string; to: string; subject: string | null; status: string; createdAt: string; }

export default function EmailComposerPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [audience, setAudience] = useState<AudienceValue>({ scope: "ALL_CONSIGNORS", role: null, tag: null });
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);

  const loadLog = useCallback(() => {
    fetch("/api/email-log?type=BROADCAST").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setLog(d.logs || []); });
  }, []);

  // Live recipient count whenever the audience changes.
  useEffect(() => {
    const params = new URLSearchParams({ scope: audience.scope, ...(audience.role ? { role: audience.role } : {}), ...(audience.tag ? { tag: audience.tag } : {}) });
    setCount(null);
    fetch(`/api/email/recipients?${params}`)
      .then((r) => {
        if (r.status === 403 || r.status === 401) { setAllowed(false); return null; }
        setAllowed(true);
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d && typeof d.count === "number") setCount(d.count); })
      .catch(() => {});
  }, [audience]);

  useEffect(() => { loadLog(); }, [loadLog]);

  const payload = () => ({
    audienceScope: audience.scope, audienceRole: audience.role, audienceTag: audience.tag,
    subject, message,
  });

  const sendTest = async () => {
    setBusy(true); setNotice(null);
    const res = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(), test: true }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setNotice({ kind: "ok", text: `Test sent to ${d.to}.` });
    else setNotice({ kind: "err", text: d.error || "Test failed." });
  };

  const sendReal = async () => {
    if (!confirm(`Send “${subject}” to ${count ?? 0} ${count === 1 ? "person" : "people"} (${describeAudience(audience)})? This can't be undone.`)) return;
    setBusy(true); setNotice(null);
    const res = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotice({ kind: "ok", text: `Sent to ${d.sent} ${d.sent === 1 ? "person" : "people"}${d.failed ? ` — ${d.failed} failed` : ""}.` });
      setSubject(""); setMessage(""); loadLog();
    } else setNotice({ kind: "err", text: d.error || "Send failed." });
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Email is owner & manager only</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">You don't have permission to send audience emails.</p>
        </div>
      </div>
    );
  }

  const canSend = subject.trim() && message.trim() && (count ?? 0) > 0 && !busy;

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div>
        <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><Mail className="h-7 w-7 text-accent" /> Email blast</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1">Send a branded email to a chosen audience — same targeting as the content feed.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)] gap-6">
        {/* Composer */}
        <div className="space-y-4">
          <AudienceSelect value={audience} onChange={setAudience} />

          <div className="rounded-2xl bg-chip px-4 py-3 flex items-center gap-2.5">
            <Users className="h-5 w-5 text-accent shrink-0" />
            <span className="text-[14px] text-ink">
              {count === null ? "Counting recipients…" : <><b>{count}</b> {count === 1 ? "person" : "people"} will receive this</>}
              {count === 0 && <span className="text-[var(--muted)]"> — no one in this audience has an email on file.</span>}
            </span>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1.5">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Fall clearance starts Friday" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1.5">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} placeholder="Write your email… blank lines start new paragraphs." className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink resize-y leading-relaxed" />
            <p className="text-[12px] text-[var(--muted)] mt-1">Plain text — we wrap it in your branded template automatically.</p>
          </div>

          {notice && (
            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] ${notice.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-[var(--danger-ink)]"}`}>
              {notice.kind === "ok" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
              {notice.text}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line px-4 py-2.5 text-[15px] font-semibold text-ink hover:bg-chip"><Eye className="h-4.5 w-4.5" /> {preview ? "Hide preview" : "Preview"}</button>
            <button onClick={sendTest} disabled={!subject.trim() || !message.trim() || busy} className="rounded-full border-[1.5px] border-line px-4 py-2.5 text-[15px] font-semibold text-ink hover:bg-chip disabled:opacity-50">Send test to me</button>
            <button onClick={sendReal} disabled={!canSend} className="inline-flex items-center gap-1.5 rounded-full bg-accent text-[var(--accent-ink)] px-5 py-2.5 text-[15px] font-bold disabled:opacity-50"><Send className="h-4.5 w-4.5" /> Send to {count ?? 0}</button>
          </div>
        </div>

        {/* Preview + recent */}
        <div className="space-y-5">
          {preview && (
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Preview</div>
              <div className="rounded-2xl border-[1.5px] border-line overflow-hidden bg-[#f9fafb]">
                <div className="bg-accent px-5 py-4 text-white font-bold text-[18px]">Your store</div>
                <div className="bg-white m-4 rounded-xl border border-line p-5">
                  <h2 className="text-[20px] font-bold text-[#111827]">{subject || "Subject line"}</h2>
                  <div className="mt-3 space-y-2.5">
                    {(message || "Your message appears here.").split(/\n{2,}/).map((p, i) => (
                      <p key={i} className="text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap">{p}</p>
                    ))}
                  </div>
                  <p className="mt-6 text-[12px] text-[#9ca3af]">This email was sent by your store.</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Recent blasts</div>
            {log.length === 0 ? (
              <p className="text-[14px] text-[var(--muted)]">No email blasts yet.</p>
            ) : (
              <div className="space-y-2">
                {log.map((l) => (
                  <div key={l.id} className="rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[14.5px] text-ink truncate">{l.subject || "(no subject)"}</span>
                      <span className={`text-[11px] font-bold uppercase rounded-full px-2 py-0.5 ${l.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{l.status}</span>
                    </div>
                    <div className="text-[12.5px] text-[var(--muted)] mt-0.5">{l.to} · {new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
