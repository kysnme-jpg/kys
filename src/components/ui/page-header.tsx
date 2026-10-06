"use client";

import { useEffect, useState } from "react";

function todayLine(storeName?: string) {
  const d = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return storeName ? `${d} · ${storeName}` : d;
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const [storeName, setStoreName] = useState<string>("");

  useEffect(() => {
    fetch("/api/store").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.name) setStoreName(d.name); }).catch(() => {});
  }, []);

  return (
    <div className="flex items-end justify-between gap-4 mb-[26px] flex-wrap">
      <div>
        <p className="text-[15px] font-medium text-[var(--muted)] mb-1.5">{todayLine(storeName)}</p>
        <h1 className="font-serif text-[40px] sm:text-[60px] leading-none text-ink text-balance">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
