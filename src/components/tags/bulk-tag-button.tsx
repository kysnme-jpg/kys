"use client";

import { useEffect, useState } from "react";
import { Tag as TagIcon } from "lucide-react";

interface Tag { id: string; name: string; color: string; }

/**
 * Bulk "apply tag" control for the People lists. Pass the selected consignor or
 * customer ids; picking a tag adds it to all of them.
 */
export function BulkTagButton({ consignorIds, customerIds, onDone }: { consignorIds?: string[]; customerIds?: string[]; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  useEffect(() => { if (open && tags.length === 0) fetch("/api/tags").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setTags(d.tags || []); }); }, [open, tags.length]);

  const apply = async (tagId: string) => {
    setOpen(false);
    await fetch("/api/tags/assign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId, action: "add", ...(consignorIds ? { consignorIds } : {}), ...(customerIds ? { customerIds } : {}) }),
    });
    onDone?.();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-sm bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><TagIcon className="h-3.5 w-3.5" /> Tag</button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 rounded-2xl border-[1.5px] border-line bg-surface shadow-lg p-1.5 z-20 text-ink" onMouseLeave={() => setOpen(false)}>
          {tags.length === 0 ? (
            <p className="px-2 py-2 text-[13px] text-[var(--muted)]">No tags yet. Create them in More → Tags.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {tags.map((t) => (
                <button key={t.id} onClick={() => apply(t.id)} className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[14px] hover:bg-chip">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                  <span className="flex-1 text-left">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
