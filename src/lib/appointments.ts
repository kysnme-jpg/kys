// Consignment appointment scheduling rules for Classic Consigns by KYS.
// Appointments are Saturdays only, between 12–3pm, in 40-minute slots,
// no more than 4 per day (one per slot).

export const SLOT_TIMES = [
  { h: 12, m: 0 },  // 12:00 PM
  { h: 12, m: 40 }, // 12:40 PM
  { h: 13, m: 20 }, // 1:20 PM
  { h: 14, m: 0 },  // 2:00 PM
];

export const SLOT_MINUTES = 40;
export const MAX_APPTS_PER_DAY = SLOT_TIMES.length;
// Custom (any day / any time) appointments use slot numbers at/above this base,
// so the standard Saturday slots (0-3) stay reserved and uniquely constrained.
export const CUSTOM_SLOT_BASE = 10;

// "16:30" -> "4:30 PM"
export function formatTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return hhmm || "";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

export function isSaturday(key: string): boolean {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6;
}

export function slotLabel(slot: number): string {
  const t = SLOT_TIMES[slot];
  if (!t) return "";
  const startMin = t.h * 60 + t.m;
  const endMin = startMin + SLOT_MINUTES;
  const fmt = (mins: number) => {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(startMin)} – ${fmt(endMin)}`;
}

// yyyy-mm-dd for a Date (UTC, date-only)
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The next `count` Saturdays (as yyyy-mm-dd strings), starting with today if
// today is a Saturday.
export function upcomingSaturdays(count = 8, from = new Date()): string[] {
  const out: string[] = [];
  // Work in UTC date-only to avoid timezone drift.
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  // 6 = Saturday
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < count; i++) {
    out.push(dateKey(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

export function prettyDate(key: string): string {
  // key is yyyy-mm-dd; render without timezone shifting
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function prettyDateShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}
