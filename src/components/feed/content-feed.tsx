"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Newspaper, Calendar, Tag, ExternalLink, Check } from "lucide-react";

export interface FeedPost {
  id: string;
  type: "ANNOUNCEMENT" | "NEWS" | "EVENT" | "PROMOTION";
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  rsvpEnabled?: boolean;
  publishAt?: string | null;
  createdAt: string;
  myRsvp?: string | null;
}

const TYPE_META: Record<FeedPost["type"], { label: string; icon: typeof Megaphone }> = {
  ANNOUNCEMENT: { label: "Announcement", icon: Megaphone },
  NEWS: { label: "News", icon: Newspaper },
  EVENT: { label: "Event", icon: Calendar },
  PROMOTION: { label: "Promotion", icon: Tag },
};

/**
 * Renders the content feed (§2). Works for staff (cookie auth) and the consignor
 * portal (Bearer token via `authHeaders`). The server decides which posts this
 * viewer may see — this component only displays what it is handed.
 */
export function ContentFeed({
  authHeaders,
  emptyLabel = "No updates yet.",
  compact = false,
}: {
  authHeaders?: () => Record<string, string>;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const headers = useCallback(() => (authHeaders ? authHeaders() : {}), [authHeaders]);

  useEffect(() => {
    fetch("/api/posts/feed", { headers: headers() })
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]));
  }, [headers]);

  const rsvp = async (postId: string, response: string) => {
    setPosts((prev) => prev?.map((p) => (p.id === postId ? { ...p, myRsvp: response } : p)) || prev);
    try {
      await fetch(`/api/posts/${postId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ response }),
      });
    } catch {}
  };

  if (posts === null) return <div className="text-[14px] text-[var(--muted)] px-1 py-4">Loading…</div>;
  if (posts.length === 0) return <div className="text-[14px] text-[var(--muted)] px-1 py-4">{emptyLabel}</div>;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {posts.map((p) => {
        const meta = TYPE_META[p.type] || TYPE_META.ANNOUNCEMENT;
        const Icon = meta.icon;
        const when = p.publishAt || p.createdAt;
        return (
          <article key={p.id} className="rounded-3xl border-[1.5px] border-line bg-surface overflow-hidden">
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="w-full max-h-56 object-cover" />
            )}
            <div className={compact ? "p-4" : "p-5"}>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-accent uppercase tracking-wide">
                <Icon className="h-4 w-4" strokeWidth={2} />
                {meta.label}
                <span className="text-[var(--muted)] font-normal normal-case tracking-normal">
                  · {new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <h3 className="font-serif text-[20px] text-ink mt-1.5 leading-tight">{p.title}</h3>
              {p.body && <p className="text-[15px] text-ink/80 mt-1.5 whitespace-pre-wrap leading-relaxed">{p.body}</p>}

              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                {p.linkUrl && (
                  <a
                    href={p.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3.5 py-1.5 text-[14px] font-semibold text-ink hover:bg-line-soft"
                  >
                    {p.linkLabel || "Learn more"} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {p.rsvpEnabled && (
                  <button
                    onClick={() => rsvp(p.id, p.myRsvp === "YES" ? "NO" : "YES")}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors",
                      p.myRsvp === "YES" ? "bg-accent text-[var(--accent-ink)]" : "bg-chip text-ink hover:bg-line-soft",
                    ].join(" ")}
                  >
                    {p.myRsvp === "YES" ? <><Check className="h-4 w-4" /> You're in</> : "RSVP"}
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
