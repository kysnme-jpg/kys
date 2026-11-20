// Calendar days in the store's own timezone (so "today" means today in
// Baltimore, not in UTC on the server).

const DEFAULT_TZ = "America/New_York";

function safeTz(tz?: string | null): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** How far the zone's wall clock is ahead of UTC at `at`, in ms. */
function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const p: Record<string, number> = {};
  for (const x of parts) if (x.type !== "literal") p[x.type] = Number(x.value);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the given calendar day starts in the zone. */
function startOfDay(y: number, m: number, d: number, tz: string): Date {
  const wallMidnight = Date.UTC(y, m - 1, d);
  // Two passes settle the offset on days when the clocks change.
  let t = wallMidnight - tzOffsetMs(tz, new Date(wallMidnight));
  t = wallMidnight - tzOffsetMs(tz, new Date(t));
  return new Date(t);
}

/** Today's date (YYYY-MM-DD) in the zone. */
export function todayIn(tz?: string | null, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: safeTz(tz), year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Is this a real YYYY-MM-DD date? */
export function isDateKey(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Start (inclusive) and end (exclusive) of a calendar day in the zone. */
export function dayRange(dateKey: string, tz?: string | null): { start: Date; end: Date } {
  const zone = safeTz(tz);
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return {
    start: startOfDay(y, m, d, zone),
    end: startOfDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), zone),
  };
}

/** The day before/after a YYYY-MM-DD date. */
export function shiftDay(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
