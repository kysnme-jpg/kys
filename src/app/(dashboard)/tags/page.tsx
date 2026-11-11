"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag as TagIcon, Plus, Trash2, Lock } from "lucide-react";

interface Tag { id: string; name: string; color: string; count: number; }

const SWATCHES = ["#b4532a", "#2a6f97", "#3a7d44", "#8e44ad", "#c2185b", "#d98a4e", "#555555"];

export default function TagsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/tags").then((r) => {
      if (r.status === 401 || r.status === 403) { setAllowed(false); return null; }
      setAllowed(true); return r.json();
    }).then((d) => { if (d) setTags(d.tags || []); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    const res = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not create."); return; }
    setName(""); load();
  };

  const remove = async (t: Tag) => {
    if (!confirm(`Delete the “${t.name}” tag? It will be removed from ${t.count} ${t.count === 1 ? "person" : "people"} (no one is deleted).`)) return;
    await fetch(`/api/tags/${t.id}`, { method: "DELETE" });
    load();
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Tags are owner & manager only</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">You can apply existing tags to people, but only owners/managers manage the tag list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div>
        <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><TagIcon className="h-7 w-7 text-accent" /> Tags</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1">Group consignors & customers, then target them in the feed and email blasts.</p>
      </div>

      <div className="rounded-3xl border-[1.5px] border-line bg-surface p-5 max-w-xl space-y-3">
        <div className="text-[13px] font-semibold text-[var(--muted)]">New tag</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder="e.g. VIP, Handbags, Fall event" className="flex-1 min-w-40 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
          <div className="flex items-center gap-1.5">
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
            ))}
          </div>
          <button onClick={create} disabled={!name.trim() || busy} className="inline-flex items-center gap-1.5 rounded-full bg-accent text-[var(--accent-ink)] px-4 py-2.5 text-[15px] font-bold disabled:opacity-50"><Plus className="h-4.5 w-4.5" /> Add</button>
        </div>
        {error && <p className="text-[14px] text-[var(--danger-ink)]">{error}</p>}
      </div>

      <div className="max-w-xl">
        {tags.length === 0 ? (
          <p className="text-[15px] text-[var(--muted)]">No tags yet.</p>
        ) : (
          <div className="space-y-2">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3">
                <span className="inline-flex items-center gap-2.5">
                  <span className="h-4 w-4 rounded-full" style={{ background: t.color }} />
                  <span className="font-semibold text-[15px] text-ink">{t.name}</span>
                  <span className="text-[13px] text-[var(--muted)]">{t.count} {t.count === 1 ? "person" : "people"}</span>
                </span>
                <button onClick={() => remove(t)} className="rounded-full p-2 hover:bg-chip" aria-label="Delete"><Trash2 className="h-4 w-4 text-[var(--danger-ink)]" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
