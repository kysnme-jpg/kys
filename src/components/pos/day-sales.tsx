"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { shiftDay } from "@/lib/day-range";

interface Row {
  key: string; itemId: string; time: string; title: string; sku: string; brand?: string | null; size?: string | null;
  consignor: string | null; storeOwned: boolean; price: number; how: string; saleId: string | null;
  customer: string | null; refunded: boolean;
}
interface DayData { date: string; today: string; timezone: string; rows: Row[]; count: number; total: number }

const dayLabel = (key: string, today: string) => {
  if (key === today) return "Sold today";
  if (key === shiftDay(today, -1)) return "Sold yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return "Sold " + new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

/** Every item sold on a day, with its consignor — under the POS search box. */
export function DaySales({ refreshKey = 0 }: { refreshKey?: number }) {
  const [date, setDate] = useState<string | null>(null); // null = today
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/sales/day${date ? `?date=${date}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: DayData) => { if (live) { setData(d); setError(""); } })
      .catch(() => { if (live) setError("Couldn't load the day's sales."); });
    return () => { live = false; };
  }, [date, refreshKey]);

  const shown = data?.date ?? date;
  const today = data?.today;
  const go = (days: number) => { if (shown) { setDate(shiftDay(shown, days)); setFilter(""); } };

  const q = filter.trim().toLowerCase();
  const rows = (data?.rows || []).filter((r) => !q || [r.title, r.sku, r.brand, r.consignor, r.customer].some((v) => v?.toLowerCase().includes(q)));

  return (
    <section className="mt-6" aria-label="Items sold">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h2 className="font-serif text-[28px] leading-none text-ink mr-auto">{shown && today ? dayLabel(shown, today) : "Sold today"}</h2>
        <div className="flex items-center gap-2">
        <button type="button" onClick={() => go(-1)} aria-label="Previous day" className="h-10 w-10 rounded-full bg-chip flex items-center justify-center text-ink hover:bg-[var(--line-soft)]"><ChevronLeft className="h-5 w-5" /></button>
        <input type="date" value={shown || ""} max={today} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setFilter(""); } }}
          aria-label="Pick a day" className="h-10 w-[150px] rounded-full bg-chip px-3 text-[14px] font-medium text-ink focus:outline-none" />
        <button type="button" onClick={() => go(1)} disabled={!shown || !today || shown >= today} aria-label="Next day" className="h-10 w-10 rounded-full bg-chip flex items-center justify-center text-ink hover:bg-[var(--line-soft)] disabled:opacity-35"><ChevronRight className="h-5 w-5" /></button>
        {shown && today && shown !== today && (
          <button type="button" onClick={() => { setDate(null); setFilter(""); }} className="h-10 rounded-full px-4 text-[14px] font-semibold bg-ink text-[var(--panel-ink)]">Today</button>
        )}
        </div>
      </div>

      {error && <p className="text-[15px] text-[var(--danger-ink)]">{error}</p>}

      {data && (
        <>
          <p className="text-[15px] text-[var(--muted)] mb-3">
            {data.count} item{data.count === 1 ? "" : "s"} sold · {formatCurrency(data.total)} <span className="text-[13px]">(tag prices, before tax &amp; discounts)</span>
          </p>

          {data.rows.length > 5 && (
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find in this list: item, SKU, consignor or customer"
                className="w-full h-11 rounded-full border-[1.5px] border-line bg-surface pl-10 pr-4 text-[15px] text-ink placeholder:text-[var(--placeholder)] focus:outline-none focus:border-accent" />
            </div>
          )}

          {data.rows.length === 0 ? (
            <div className="rounded-[22px] border-[1.5px] border-dashed border-line py-10 flex flex-col items-center gap-2 text-[var(--muted)]">
              <Receipt className="h-7 w-7" /><p>Nothing sold {data.date === data.today ? "yet today" : "this day"}.</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-[15px] text-[var(--muted)] py-4">No sold item matches &ldquo;{filter}&rdquo;.</p>
          ) : (
            <div className="rounded-[22px] border-[1.5px] border-line-soft bg-surface divide-y divide-[var(--line-soft)] overflow-hidden">
              {rows.map((r) => (
                <a key={r.key} href={`/inventory/${r.itemId}/edit?from=/pos`} className="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-chip transition-colors">
                  <span className="w-[64px] shrink-0 text-[13px] font-medium text-[var(--muted)] tabular-nums">
                    {new Date(r.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: data.timezone })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[16px] font-semibold text-ink truncate ${r.refunded ? "line-through opacity-60" : ""}`}>{r.title}</p>
                    <p className="text-[14px] text-[var(--muted)] truncate">
                      <span className="font-semibold text-ink">{r.storeOwned ? "Store-owned" : r.consignor ? `Consignor: ${r.consignor}` : "No consignor"}</span>
                      {[r.sku, r.size && `Sz ${r.size}`, r.customer && `Customer: ${r.customer}`].filter(Boolean).map((t) => ` · ${t}`).join("")}
                    </p>
                  </div>
                  <span className={`hidden sm:inline-flex shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${r.refunded ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]" : "bg-chip text-[var(--muted)]"}`}>
                    {r.refunded ? "Refunded" : r.how}
                  </span>
                  <span className={`shrink-0 text-[17px] font-bold tabular-nums ${r.refunded ? "line-through text-[var(--muted)]" : "text-accent"}`}>{formatCurrency(r.price)}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
