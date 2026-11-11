"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Hash, Send, Lock, ArrowLeft, Plus, Users, MessagesSquare, X } from "lucide-react";

interface Channel { id: string; name: string; description: string | null; lastMessageAt: string; unread: number; }
interface Direct { id: string; title: string; otherNames: string[]; lastMessageAt: string; unread: number; }
interface MsgRow { id: string; senderUserId: string; senderName: string; mine: boolean; body: string; createdAt: string; }
interface StaffRef { id: string; name: string; role: string; }
type Active = { kind: "channel" | "thread"; id: string } | null;

export default function TeamPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Direct[]>([]);
  const [active, setActive] = useState<Active>(null);
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [modal, setModal] = useState<null | "channel" | "dm">(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadLists = useCallback(() => {
    Promise.all([
      fetch("/api/internal/channels").then((r) => { if (r.status === 403 || r.status === 401) { setAllowed(false); return null; } setAllowed(true); return r.json(); }),
      fetch("/api/internal/threads").then((r) => (r.ok ? r.json() : null)),
    ]).then(([c, t]) => { if (c) setChannels(c.channels || []); if (t) setThreads(t.threads || []); });
  }, []);

  const loadConversation = useCallback((a: Active) => {
    if (!a) return;
    const url = a.kind === "channel" ? `/api/internal/channels/${a.id}` : `/api/internal/threads/${a.id}`;
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      setMessages(d.messages || []);
      setTitle(a.kind === "channel" ? `#${d.channel?.name || ""}` : d.thread?.title || "Conversation");
      loadLists();
    });
  }, [loadLists]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { if (active) loadConversation(active); }, [active, loadConversation]);
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!draft.trim() || !active || sending) return;
    setSending(true);
    const url = active.kind === "channel" ? `/api/internal/channels/${active.id}` : `/api/internal/threads/${active.id}`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
    setSending(false);
    if (res.ok) { setDraft(""); loadConversation(active); }
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Team chat needs the comms permission</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">You don't have permission for internal messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="mb-5">
        <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><MessagesSquare className="h-7 w-7 text-accent" /> Team chat</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1">Private staff messaging — channels for the team, direct messages for one-on-one.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[72vh] min-h-[420px]">
        {/* Sidebar */}
        <div className={`rounded-3xl border-[1.5px] border-line bg-surface overflow-y-auto ${active ? "max-md:hidden" : ""}`}>
          <Section label="Channels" onAdd={() => setModal("channel")} addLabel="New channel">
            {channels.map((c) => (
              <ListRow key={c.id} icon={<Hash className="h-4 w-4 text-[var(--muted)] shrink-0" />} title={c.name} subtitle={c.description || ""}
                active={active?.kind === "channel" && active.id === c.id} unread={c.unread} onClick={() => setActive({ kind: "channel", id: c.id })} />
            ))}
          </Section>
          <Section label="Direct messages" onAdd={() => setModal("dm")} addLabel="New message">
            {threads.length === 0 && <p className="px-4 py-2 text-[13px] text-[var(--muted)]">No direct messages yet.</p>}
            {threads.map((t) => (
              <ListRow key={t.id} icon={<Users className="h-4 w-4 text-[var(--muted)] shrink-0" />} title={t.title} subtitle=""
                active={active?.kind === "thread" && active.id === t.id} unread={t.unread} onClick={() => setActive({ kind: "thread", id: t.id })} />
            ))}
          </Section>
        </div>

        {/* Conversation */}
        <div className={`rounded-3xl border-[1.5px] border-line bg-surface flex flex-col overflow-hidden ${active ? "" : "max-md:hidden"}`}>
          {!active ? (
            <div className="flex-1 grid place-items-center text-[14px] text-[var(--muted)] px-6 text-center">Pick a channel or a teammate to start chatting.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <button onClick={() => setActive(null)} className="md:hidden rounded-full p-1.5 hover:bg-chip"><ArrowLeft className="h-5 w-5 text-[var(--muted)]" /></button>
                <div className="font-semibold text-[16px] text-ink truncate">{title}</div>
              </div>
              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {messages.length === 0 && <p className="text-center text-[14px] text-[var(--muted)] py-8">No messages yet. Say hello.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${m.mine ? "bg-accent text-[var(--accent-ink)] rounded-br-md" : "bg-chip text-ink rounded-bl-md"}`}>
                      {!m.mine && <p className="text-[11px] font-bold text-[var(--muted)] mb-0.5">{m.senderName}</p>}
                      <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10.5px] mt-1 ${m.mine ? "text-white/70" : "text-[var(--muted)]"}`}>{new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-line p-3 flex items-end gap-2">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1} placeholder={`Message ${title}…`} className="flex-1 max-h-28 rounded-2xl border-[1.5px] border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-accent resize-none" />
                <button onClick={send} disabled={!draft.trim() || sending} className="h-11 w-11 rounded-full bg-accent text-[var(--accent-ink)] grid place-items-center shrink-0 disabled:opacity-40"><Send className="h-4.5 w-4.5" /></button>
              </div>
            </>
          )}
        </div>
      </div>

      {modal === "channel" && <NewChannel onClose={() => setModal(null)} onCreated={(id) => { setModal(null); loadLists(); setActive({ kind: "channel", id }); }} />}
      {modal === "dm" && <NewDirect onClose={() => setModal(null)} onCreated={(id) => { setModal(null); loadLists(); setActive({ kind: "thread", id }); }} />}
    </div>
  );
}

function Section({ label, onAdd, addLabel, children }: { label: string; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
        <button onClick={onAdd} title={addLabel} className="rounded-full p-1 hover:bg-chip"><Plus className="h-4 w-4 text-[var(--muted)]" /></button>
      </div>
      {children}
    </div>
  );
}

function ListRow({ icon, title, subtitle, active, unread, onClick }: { icon: React.ReactNode; title: string; subtitle: string; active: boolean; unread: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors ${active ? "bg-chip" : "hover:bg-chip/60"}`}>
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[14.5px] text-ink truncate">{title}</span>
        {subtitle && <span className="block text-[12px] text-[var(--muted)] truncate">{subtitle}</span>}
      </span>
      {unread > 0 && <span className="shrink-0 bg-accent text-[var(--accent-ink)] text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{unread}</span>}
    </button>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-surface w-full sm:w-[min(460px,calc(100vw-32px))] max-h-[88vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border-[1.5px] border-line p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[22px] text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-chip"><X className="h-5 w-5 text-[var(--muted)]" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewChannel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/internal/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not create."); return; }
    const d = await res.json(); onCreated(d.channel.id);
  };
  return (
    <Shell title="New channel" onClose={onClose}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name (e.g. store-floor)" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's it for? (optional)" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
      {error && <p className="text-[14px] text-[var(--danger-ink)]">{error}</p>}
      <button onClick={create} disabled={!name.trim() || busy} className="w-full rounded-full bg-accent text-[var(--accent-ink)] py-2.5 text-[15px] font-bold disabled:opacity-60">{busy ? "Creating…" : "Create channel"}</button>
    </Shell>
  );
}

function NewDirect({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [staff, setStaff] = useState<StaffRef[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/internal/directory").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setStaff(d.staff || []); }); }, []);
  const toggle = (id: string) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const start = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/internal/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: Array.from(picked) }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not start."); return; }
    const d = await res.json(); onCreated(d.thread.id);
  };
  return (
    <Shell title="New message" onClose={onClose}>
      {staff.length === 0 ? (
        <p className="text-[14px] text-[var(--muted)]">No other staff accounts yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {staff.map((s) => (
            <button key={s.id} onClick={() => toggle(s.id)} className={`w-full flex items-center justify-between rounded-2xl border-[1.5px] px-3.5 py-2.5 transition-colors ${picked.has(s.id) ? "border-accent bg-accent/5" : "border-line hover:bg-chip"}`}>
              <span className="text-[15px] font-semibold text-ink">{s.name}</span>
              <span className="text-[12px] text-[var(--muted)] capitalize">{s.role.toLowerCase().replace("_", " ")}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[14px] text-[var(--danger-ink)]">{error}</p>}
      <button onClick={start} disabled={picked.size === 0 || busy} className="w-full rounded-full bg-accent text-[var(--accent-ink)] py-2.5 text-[15px] font-bold disabled:opacity-60">{busy ? "Starting…" : "Start conversation"}</button>
    </Shell>
  );
}
