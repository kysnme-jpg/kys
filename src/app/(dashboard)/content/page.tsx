"use client";

import { useEffect, useState, useCallback } from "react";
import { Megaphone, Plus, Pencil, Trash2, Eye, Lock } from "lucide-react";
import { AudienceSelect, type AudienceValue } from "@/components/audience/audience-select";
import { POST_TYPES, describeAudience, type AudienceScope } from "@/lib/posts";

interface AdminPost {
  id: string;
  type: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  rsvpEnabled: boolean;
  audienceScope: AudienceScope;
  audienceRole?: string | null;
  audienceTag?: string | null;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  publishAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  _count?: { rsvps: number };
}

const EMPTY = {
  type: "ANNOUNCEMENT",
  title: "",
  body: "",
  imageUrl: "",
  linkUrl: "",
  linkLabel: "",
  rsvpEnabled: false,
  audience: { scope: "EVERYONE" as AudienceScope, role: null, tag: null } as AudienceValue,
  status: "PUBLISHED" as "DRAFT" | "PUBLISHED" | "RETIRED",
  publishAt: "",
  expiresAt: "",
};

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ContentAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof EMPTY | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/posts")
      .then((r) => {
        if (r.status === 403 || r.status === 401) { setAllowed(false); return null; }
        setAllowed(true);
        return r.json();
      })
      .then((d) => { if (d) setPosts(d.posts || []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setEditing({ ...EMPTY, audience: { scope: "EVERYONE", role: null, tag: null } }); setError(""); };
  const openEdit = (p: AdminPost) => {
    setEditId(p.id);
    setEditing({
      type: p.type, title: p.title, body: p.body,
      imageUrl: p.imageUrl || "", linkUrl: p.linkUrl || "", linkLabel: p.linkLabel || "",
      rsvpEnabled: p.rsvpEnabled, status: p.status,
      audience: { scope: p.audienceScope, role: p.audienceRole || null, tag: p.audienceTag || null },
      publishAt: toLocalInput(p.publishAt), expiresAt: toLocalInput(p.expiresAt),
    });
    setError("");
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError("");
    const payload = {
      type: editing.type, title: editing.title, body: editing.body,
      imageUrl: editing.imageUrl || null, linkUrl: editing.linkUrl || null, linkLabel: editing.linkLabel || null,
      rsvpEnabled: editing.rsvpEnabled, status: editing.status,
      audienceScope: editing.audience.scope, audienceRole: editing.audience.role, audienceTag: editing.audience.tag,
      publishAt: editing.publishAt ? new Date(editing.publishAt).toISOString() : null,
      expiresAt: editing.expiresAt ? new Date(editing.expiresAt).toISOString() : null,
    };
    const res = await fetch(editId ? `/api/posts/${editId}` : "/api/posts", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not save."); return; }
    setEditing(null); setEditId(null); load();
  };

  const retire = async (p: AdminPost) => {
    await fetch(`/api/posts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RETIRED" }) });
    load();
  };
  const publish = async (p: AdminPost) => {
    await fetch(`/api/posts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PUBLISHED" }) });
    load();
  };
  const remove = async (p: AdminPost) => {
    if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
    await fetch(`/api/posts/${p.id}`, { method: "DELETE" });
    load();
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Content is owner & manager only</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">You don't have permission to manage posts. Ask the owner if you need access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><Megaphone className="h-7 w-7 text-accent" /> Content feed</h1>
          <p className="text-[15px] text-[var(--muted)] mt-1">Announcements, news, events and promotions — shown to the audience you choose.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-full bg-accent text-[var(--accent-ink)] font-bold px-5 py-2.5 active:scale-[.98] transition-transform">
          <Plus className="h-5 w-5" /> New post
        </button>
      </div>

      {loading ? (
        <div className="text-[15px] text-[var(--muted)]">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border-[1.5px] border-dashed border-line p-10 text-center">
          <p className="text-[15px] text-[var(--muted)]">No posts yet. Create your first announcement.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const scheduled = p.status === "PUBLISHED" && p.publishAt && new Date(p.publishAt) > new Date();
            const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
            return (
              <div key={p.id} className="rounded-3xl border-[1.5px] border-line bg-surface p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-accent">{POST_TYPES.find((t) => t.value === p.type)?.label || p.type}</span>
                      <StatusPill status={p.status} scheduled={!!scheduled} expired={!!expired} />
                    </div>
                    <h3 className="font-serif text-[19px] text-ink mt-1 truncate">{p.title}</h3>
                    <p className="text-[13px] text-[var(--muted)] mt-1">
                      {describeAudience({ scope: p.audienceScope, role: p.audienceRole, tag: p.audienceTag })}
                      {scheduled && p.publishAt && <> · goes live {new Date(p.publishAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>}
                      {p.rsvpEnabled && <> · {p._count?.rsvps || 0} RSVP{(p._count?.rsvps || 0) === 1 ? "" : "s"}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.status !== "PUBLISHED" && <button onClick={() => publish(p)} className="rounded-full bg-chip px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-line-soft">Publish</button>}
                    {p.status === "PUBLISHED" && <button onClick={() => retire(p)} className="rounded-full bg-chip px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-line-soft">Retire</button>}
                    <button onClick={() => openEdit(p)} className="rounded-full p-2 hover:bg-chip" aria-label="Edit"><Pencil className="h-4 w-4 text-[var(--muted)]" /></button>
                    <button onClick={() => remove(p)} className="rounded-full p-2 hover:bg-chip" aria-label="Delete"><Trash2 className="h-4 w-4 text-[var(--danger-ink)]" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Editor
          value={editing}
          onChange={setEditing}
          onSave={save}
          onClose={() => { setEditing(null); setEditId(null); }}
          saving={saving}
          error={error}
          isEdit={!!editId}
        />
      )}
    </div>
  );
}

function StatusPill({ status, scheduled, expired }: { status: string; scheduled: boolean; expired: boolean }) {
  let label = status === "DRAFT" ? "Draft" : status === "RETIRED" ? "Retired" : "Live";
  let cls = "bg-chip text-[var(--muted)]";
  if (status === "PUBLISHED" && scheduled) { label = "Scheduled"; cls = "bg-accent/10 text-accent"; }
  else if (status === "PUBLISHED" && expired) { label = "Expired"; cls = "bg-chip text-[var(--muted)]"; }
  else if (status === "PUBLISHED") { cls = "bg-green-100 text-green-700"; }
  return <span className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

function Editor({
  value, onChange, onSave, onClose, saving, error, isEdit,
}: {
  value: typeof EMPTY; onChange: (v: typeof EMPTY) => void; onSave: () => void; onClose: () => void; saving: boolean; error: string; isEdit: boolean;
}) {
  const set = (patch: Partial<typeof EMPTY>) => onChange({ ...value, ...patch });
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-surface w-full sm:w-[min(560px,calc(100vw-32px))] max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border-[1.5px] border-line p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[22px] text-ink">{isEdit ? "Edit post" : "New post"}</h2>
          <button onClick={() => setShowPreview((v) => !v)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent"><Eye className="h-4 w-4" /> {showPreview ? "Edit" : "Preview"}</button>
        </div>

        {showPreview ? (
          <PreviewCard value={value} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {POST_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => set({ type: t.value })}
                  className={`rounded-2xl border-[1.5px] px-3 py-2 text-[14px] font-semibold transition-colors ${value.type === t.value ? "border-accent bg-accent/5 text-ink" : "border-line text-[var(--muted)] hover:bg-chip"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <Field label="Title">
              <input value={value.title} onChange={(e) => set({ title: e.target.value })} placeholder="What's happening?" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
            </Field>
            <Field label="Message">
              <textarea value={value.body} onChange={(e) => set({ body: e.target.value })} rows={4} placeholder="Details…" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink resize-y" />
            </Field>
            <Field label="Image URL (optional)">
              <input value={value.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Link URL (optional)">
                <input value={value.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} placeholder="https://…" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
              </Field>
              <Field label="Link label">
                <input value={value.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} placeholder="Learn more" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
              </Field>
            </div>

            <AudienceSelect value={value.audience} onChange={(a) => set({ audience: a })} />

            <div className="grid grid-cols-2 gap-2">
              <Field label="Publish at (optional)">
                <input type="datetime-local" value={value.publishAt} onChange={(e) => set({ publishAt: e.target.value })} className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink" />
              </Field>
              <Field label="Expires at (optional)">
                <input type="datetime-local" value={value.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink" />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={value.rsvpEnabled} onChange={(e) => set({ rsvpEnabled: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
              <span className="text-[15px] text-ink">Let people RSVP</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--muted)]">Save as:</span>
              {(["DRAFT", "PUBLISHED"] as const).map((s) => (
                <button key={s} type="button" onClick={() => set({ status: s })}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${value.status === s ? "bg-ink text-[var(--panel-ink)]" : "bg-chip text-ink hover:bg-line-soft"}`}>
                  {s === "DRAFT" ? "Draft" : "Published"}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="text-[14px] text-[var(--danger-ink)]">{error}</p>}
        <div className="flex gap-2.5 pt-1">
          <button onClick={onClose} className="flex-1 rounded-full border-[1.5px] border-line py-2.5 text-[15px] font-semibold text-ink hover:bg-chip">Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex-1 rounded-full bg-accent text-[var(--accent-ink)] py-2.5 text-[15px] font-bold disabled:opacity-60">{saving ? "Saving…" : isEdit ? "Save changes" : "Create post"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PreviewCard({ value }: { value: typeof EMPTY }) {
  return (
    <div className="rounded-3xl border-[1.5px] border-line bg-paper overflow-hidden">
      {value.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.imageUrl} alt="" className="w-full max-h-56 object-cover" />
      )}
      <div className="p-5">
        <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">{POST_TYPES.find((t) => t.value === value.type)?.label}</div>
        <h3 className="font-serif text-[20px] text-ink mt-1.5 leading-tight">{value.title || "Untitled"}</h3>
        {value.body && <p className="text-[15px] text-ink/80 mt-1.5 whitespace-pre-wrap leading-relaxed">{value.body}</p>}
        <div className="flex flex-wrap gap-2.5 mt-3">
          {value.linkUrl && <span className="rounded-full bg-chip px-3.5 py-1.5 text-[14px] font-semibold text-ink">{value.linkLabel || "Learn more"}</span>}
          {value.rsvpEnabled && <span className="rounded-full bg-chip px-3.5 py-1.5 text-[14px] font-semibold text-ink">RSVP</span>}
        </div>
        <p className="text-[12px] text-[var(--muted)] mt-3">Shown to: {describeAudience(value.audience)}</p>
      </div>
    </div>
  );
}
