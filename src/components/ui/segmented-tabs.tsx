"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SegTab {
  label: string;
  href: string;
  /** route prefixes that should also mark this tab active */
  match?: string[];
}

export function SegmentedTabs({ tabs }: { tabs: SegTab[] }) {
  const pathname = usePathname();
  const isActive = (t: SegTab) =>
    [t.href, ...(t.match || [])].some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-chip p-1 h-12 mb-5">
      {tabs.map((t) => {
        const active = isActive(t);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center justify-center rounded-full px-5 h-10 text-[15px] font-semibold transition-colors",
              active ? "bg-ink text-[var(--panel-ink)]" : "text-[var(--muted)] hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
