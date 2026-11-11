"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag as TagIcon, Plus, X } from "lucide-react";

interface Tag { id: string; name: string; color: string; }

/**
 * Inline tag editor for a consignor or customer. Shows current tags as chips and
 * lets staff add/remove from the store's tag list.
 */
export function TagEditor({ consignorId, customerId }: { consignorId?: string; customerId?: string }) {
  const [mine, setMine] = useState<Tag[]>([]);
  const [all, setAll] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);

  const qs = consignorId ? `consignorId=${consignorId}` : `customerId=${customerId}`;
  const target = consignorId ? { consignorId } : { customerId };

  const load = useCallback(() => {
    fetch(`/api/tags/for?${qs}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setMine(d.tags || []); });
  }, [qs]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open && all.length === 0) fetch("/api/tags").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setAll(d.tags || []); }); }, [open, all.length]);

  const toggle = async (tag: Tag, add: boolean) => {
    setMine((prev) => add ? [...prev, tag] : prev.filter((t) => t.id !== tag.id));
    await fetch("/api/tags/assign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id, action: add ? "add" : "remove", ...target }),
    });
  };

  const mineIds = new Set(mine.map((t) => t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {mine.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[12.5px] font-semibold" style={{ background: `${t.color}1a`, color: t.color }}>
          {t.name}
          <button onClick={() => toggle(t, false)} className="rounded-full hover:bg-black/10 p-0.5" aria-label={`Remove ${t.name}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] font-semibold text-[var(--muted)] hover:bg-chip">
          <Plus className="h-3.5 w-3.5" /> Tag
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-56 rounded-2xl border-[1.5px] border-line bg-surface shadow-lg p-1.5" onMouseLeave={() => setOpen(false)}>
            {all.length === 0 ? (
              <p className="px-2 py-2 text-[13px] text-[var(--muted)]">No tags yet. Create them in More → Tags.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {all.map((t) => {
                  const on = mineIds.has(t.id);
                  return (
                    <button key={t.id} onClick={() => toggle(t, !on)} className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[14px] hover:bg-chip">
                      <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                      <span className="flex-1 text-left text-ink">{t.name}</span>
                      {on && <span className="text-accent text-[12px] font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
