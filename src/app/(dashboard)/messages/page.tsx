"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MessageCircle, Send, StickyNote, Lock, ArrowLeft, User } from "lucide-react";

interface ThreadSummary {
  id: string;
  externalClass: "CONSIGNOR" | "CUSTOMER";
  partyId: string;
  partyName: string;
  lastMessageAt: string;
  lastSnippet: string;
  unreadForStore: number;
  status: string;
}
interface Msg { id: string; sender: "STORE" | "CONSIGNOR" | "CUSTOMER"; body: string; createdAt: string; }
interface Note { id: string; body: string; authorUserId: string | null; createdAt: string; }
interface ThreadDetail {
  thread: { id: string; externalClass: string; partyId: string; partyName: string; status: string };
  messages: Msg[];
  notes: Note[];
}

export default function MessagesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(() => {
    fetch("/api/staff/conversations")
      .then((r) => {
        if (r.status === 403 || r.status === 401) { setAllowed(false); return null; }
        setAllowed(true);
        return r.json();
      })
      .then((d) => { if (d) setThreads(d.threads || []); })
      .catch(() => {});
  }, []);

  const loadDetail = useCallback((id: string) => {
    fetch(`/api/staff/conversations?threadId=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setDetail(d); loadThreads(); } });
  }, [loadThreads]);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { if (activeId) loadDetail(activeId); }, [activeId, loadDetail]);
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [detail?.messages]);

  const send = async () => {
    if (!draft.trim() || !activeId || sending) return;
    setSending(true);
    const res = await fetch("/api/staff/conversations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reply", threadId: activeId, body: draft }),
    });
    setSending(false);
    if (res.ok) { setDraft(""); loadDetail(activeId); }
  };

  const saveNote = async () => {
    if (!noteDraft.trim() || !activeId || sending) return;
    setSending(true);
    const res = await fetch("/api/staff/conversations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "note", threadId: activeId, body: noteDraft }),
    });
    setSending(false);
    if (res.ok) { setNoteDraft(""); setShowNote(false); loadDetail(activeId); }
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Messages need the comms permission</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">You don't have permission to see customer & consignor conversations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="mb-5">
        <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><MessageCircle className="h-7 w-7 text-accent" /> Messages</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1">Conversations with consignors and customers — all in one place.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[72vh] min-h-[420px]">
        {/* Thread list */}
        <div className={`rounded-3xl border-[1.5px] border-line bg-surface overflow-y-auto ${activeId ? "max-md:hidden" : ""}`}>
          {threads.length === 0 ? (
            <div className="p-8 text-center text-[14px] text-[var(--muted)]">No conversations yet.</div>
          ) : (
            threads.map((t) => (
              <button key={t.id} onClick={() => setActiveId(t.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-line-soft last:border-0 transition-colors ${activeId === t.id ? "bg-chip" : "hover:bg-chip/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[15px] text-ink truncate flex items-center gap-1.5">
                    <User className="h-4 w-4 text-[var(--muted)] shrink-0" /> {t.partyName}
                  </span>
                  {t.unreadForStore > 0 && <span className="shrink-0 bg-accent text-[var(--accent-ink)] text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{t.unreadForStore}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[13px] text-[var(--muted)] truncate">{t.lastSnippet || "No messages yet"}</span>
                  <span className="text-[11px] text-[var(--muted)] shrink-0">{new Date(t.lastMessageAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </div>
                <span className="inline-block mt-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">{t.externalClass === "CONSIGNOR" ? "Consignor" : "Customer"}</span>
              </button>
            ))
          )}
        </div>

        {/* Thread detail */}
        <div className={`rounded-3xl border-[1.5px] border-line bg-surface flex flex-col overflow-hidden ${activeId ? "" : "max-md:hidden"}`}>
          {!detail ? (
            <div className="flex-1 grid place-items-center text-[14px] text-[var(--muted)] px-6 text-center">Pick a conversation to read and reply.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <button onClick={() => { setActiveId(null); setDetail(null); }} className="md:hidden rounded-full p-1.5 hover:bg-chip"><ArrowLeft className="h-5 w-5 text-[var(--muted)]" /></button>
                <div className="min-w-0">
                  <div className="font-semibold text-[16px] text-ink truncate">{detail.thread.partyName}</div>
                  <div className="text-[12px] text-[var(--muted)]">{detail.thread.externalClass === "CONSIGNOR" ? "Consignor" : "Customer"}</div>
                </div>
                <button onClick={() => setShowNote((v) => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-line-soft">
                  <StickyNote className="h-4 w-4" /> Internal note
                </button>
              </div>

              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {detail.messages.length === 0 && <p className="text-center text-[14px] text-[var(--muted)] py-8">No messages yet. Say hello.</p>}
                {detail.messages.map((m) => {
                  const mine = m.sender === "STORE";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${mine ? "bg-accent text-[var(--accent-ink)] rounded-br-md" : "bg-chip text-ink rounded-bl-md"}`}>
                        <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10.5px] mt-1 ${mine ? "text-white/70" : "text-[var(--muted)]"}`}>{new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  );
                })}

                {detail.notes.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)] px-1 mb-1.5 flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Internal notes · staff only</div>
                    {detail.notes.map((n) => (
                      <div key={n.id} className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-1.5">
                        <p className="text-[13.5px] text-amber-900 whitespace-pre-wrap break-words">{n.body}</p>
                        <p className="text-[10.5px] text-amber-700/80 mt-1">{new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {showNote ? (
                <div className="border-t border-line p-3 bg-amber-50/60">
                  <div className="text-[12px] font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Internal note — {detail.thread.partyName} will NOT see this</div>
                  <div className="flex items-end gap-2">
                    <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={1} placeholder="Note for the team…" className="flex-1 max-h-28 rounded-2xl border-[1.5px] border-amber-300 bg-surface px-3.5 py-2.5 text-[14px] text-ink focus:outline-none resize-none" />
                    <button onClick={saveNote} disabled={!noteDraft.trim() || sending} className="h-11 px-4 rounded-full bg-amber-500 text-white font-semibold text-[14px] shrink-0 disabled:opacity-40">Save</button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-line p-3 flex items-end gap-2">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1} placeholder={`Reply to ${detail.thread.partyName}…`} className="flex-1 max-h-28 rounded-2xl border-[1.5px] border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent resize-none" />
                  <button onClick={send} disabled={!draft.trim() || sending} className="h-11 w-11 rounded-full bg-accent text-[var(--accent-ink)] grid place-items-center shrink-0 disabled:opacity-40"><Send className="h-4.5 w-4.5" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
