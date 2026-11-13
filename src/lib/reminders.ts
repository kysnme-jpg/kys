import { db } from "@/lib/db";
import { sendLayawayReminderEmail, sendBorrowedReturnReminderEmail, sendSipShopReminderEmail } from "@/lib/email";
import { logEmail } from "@/lib/email-log";

/**
 * Customer reminders.
 *
 *  - Layaway: one reminder every 14 days from the start date until it is paid
 *    off (or completed/cancelled).
 *  - Borrowed items: one reminder 3 days after the item was borrowed if it is
 *    still out, plus one on the return date when a return date was set.
 *  - Sip & Shop: one reminder a couple of days before the event.
 *
 * processDueReminders is idempotent and safe to run often — it is called by the
 * in-process scheduler (src/instrumentation.ts), by the cron endpoint, and when
 * staff open these pages. Each reminder is CLAIMED in the database before it is
 * sent, so two overlapping runs can never send the same reminder twice.
 * Automatic emails only go out during daytime hours in the store's timezone.
 * Staff can also send a reminder by hand at any time (the *Now functions).
 */

export const LAYAWAY_REMINDER_EVERY_DAYS = 14;
export const BORROWED_REMINDER_AFTER_DAYS = 3;
const SIP_REMINDER_DAYS_BEFORE = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const QUIET_BEFORE_HOUR = 8;  // no automatic emails before 8am…
const QUIET_FROM_HOUR = 20;   // …or from 8pm, store time

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Is it a reasonable hour to email a customer, in the store's timezone? */
export function isDaytime(now: Date, timezone?: string | null): boolean {
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone || "America/New_York" }).format(now));
  } catch {
    hour = now.getUTCHours();
  }
  return hour >= QUIET_BEFORE_HOUR && hour < QUIET_FROM_HOUR;
}

/** How many full 14-day periods have passed since the layaway started. */
export function layawayPeriodsElapsed(startDate: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (LAYAWAY_REMINDER_EVERY_DAYS * DAY_MS)));
}

interface LayawayLike {
  totalPrice: number; amountPaid: number; deposit: number; payment2: number; payment3: number; finalPayment: number; startDate: Date;
}

/** The next unpaid installment on the layaway schedule (or the whole balance). */
export function nextLayawayPayment(l: LayawayLike, now: Date): { which: string; amount: number; balance: number } {
  const balance = Math.max(0, l.totalPrice - l.amountPaid);
  const schedule = [
    { label: "Deposit", amount: l.deposit, dueDays: 0 },
    { label: "Payment 2", amount: l.payment2, dueDays: 15 },
    { label: "Payment 3", amount: l.payment3, dueDays: 30 },
    { label: "Final payment", amount: l.finalPayment, dueDays: 45 },
  ];
  let cumulative = 0;
  for (const s of schedule) {
    cumulative += s.amount || 0;
    if (l.amountPaid < cumulative - 0.005) {
      const due = addDays(l.startDate, s.dueDays);
      const owed = Math.min(balance, cumulative - l.amountPaid);
      return { which: `${s.label} — ${due.getTime() < now.getTime() ? "was due" : "due"} ${fmtShort(due)}`, amount: owed, balance };
    }
  }
  return { which: "Remaining balance", amount: balance, balance };
}

type Outcome = { ok: boolean; to: string | null; error?: string };

async function sendLayawayReminder(l: any, storeName: string, now: Date): Promise<Outcome> {
  if (!l.email) return { ok: false, to: null, error: "No email address on this layaway." };
  const next = nextLayawayPayment(l, now);
  const res = await sendLayawayReminderEmail({
    to: l.email, buyerName: l.buyerName, storeName, items: l.items,
    which: next.which, amountDue: next.amount, balanceRemaining: next.balance,
  });
  await logEmail({ storeId: l.storeId, to: l.email, type: "LAYAWAY", subject: `Layaway reminder — ${l.buyerName}`, status: res.ok ? "SENT" : "FAILED" });
  if (res.ok) await db.layaway.update({ where: { id: l.id }, data: { lastReminderAt: now } }).catch(() => {});
  return { ok: res.ok, to: l.email, error: res.error };
}

async function sendBorrowedReminder(b: any, storeName: string, now: Date): Promise<Outcome> {
  if (!b.email) return { ok: false, to: null, error: "No email address on this agreement." };
  const res = await sendBorrowedReturnReminderEmail({
    to: b.email, borrowerName: b.borrowerName, storeName, items: b.items,
    dateBorrowed: b.dateBorrowed ? fmtDate(b.dateBorrowed) : null,
    returnDate: b.returnDate ? fmtDate(b.returnDate) : null,
  });
  await logEmail({ storeId: b.storeId, to: b.email, type: "BORROWED", subject: `Borrowed items reminder — ${b.borrowerName}`, status: res.ok ? "SENT" : "FAILED" });
  if (res.ok) await db.borrowedGarment.update({ where: { id: b.id }, data: { lastReminderAt: now } }).catch(() => {});
  return { ok: res.ok, to: b.email, error: res.error };
}

// ── Manual "send now" (staff button) ─────────────────────────────────────────

export async function sendLayawayReminderNow(storeId: string, id: string): Promise<Outcome> {
  const l = await db.layaway.findFirst({ where: { id, storeId }, include: { store: { select: { name: true } } } });
  if (!l) return { ok: false, to: null, error: "Layaway not found." };
  if (l.status !== "ACTIVE") return { ok: false, to: l.email, error: `This layaway is ${l.status.toLowerCase()} — no reminder needed.` };
  if (l.totalPrice - l.amountPaid <= 0) return { ok: false, to: l.email, error: "This layaway is fully paid." };
  return sendLayawayReminder(l, l.store?.name || "Classic Consigns by KYS", new Date());
}

export async function sendBorrowedReminderNow(storeId: string, id: string): Promise<Outcome> {
  const b = await db.borrowedGarment.findFirst({ where: { id, storeId }, include: { store: { select: { name: true } } } });
  if (!b) return { ok: false, to: null, error: "Agreement not found." };
  if (b.status !== "OUT") return { ok: false, to: b.email, error: "These items have already been returned." };
  return sendBorrowedReminder(b, b.store?.name || "Classic Consigns by KYS", new Date());
}

// ── Automatic run ────────────────────────────────────────────────────────────

export async function processDueReminders(storeId?: string): Promise<{ layaway: number; borrowed: number; sipshop: number }> {
  const now = new Date();
  let layawaySent = 0;
  let borrowedSent = 0;
  let sipSent = 0;
  const scope = storeId ? { storeId } : {};

  // ── Layaway: every 14 days until paid ──
  const layaways = await db.layaway.findMany({
    where: { status: "ACTIVE", email: { not: null }, ...scope },
    include: { store: { select: { name: true, timezone: true } } },
  });
  for (const l of layaways) {
    if (!l.email) continue;
    if (l.totalPrice - l.amountPaid <= 0) continue;               // paid off
    if (!isDaytime(now, l.store?.timezone)) continue;             // wait for daytime
    const periods = layawayPeriodsElapsed(l.startDate, now);
    if (periods < 1 || periods <= l.reminderCount) continue;      // nothing new is due
    // Claim this period first; if another run got there, skip.
    const claim = await db.layaway.updateMany({ where: { id: l.id, reminderCount: l.reminderCount }, data: { reminderCount: periods } });
    if (claim.count !== 1) continue;
    const res = await sendLayawayReminder(l, l.store?.name || "Classic Consigns by KYS", now).catch(() => ({ ok: false }));
    if (res.ok) layawaySent++;
  }

  // ── Borrowed: 3 days after borrowing, if still out ──
  const dueDay3 = await db.borrowedGarment.findMany({
    where: { status: "OUT", email: { not: null }, day3ReminderAt: null, dateBorrowed: { lte: addDays(now, -BORROWED_REMINDER_AFTER_DAYS) }, ...scope },
    include: { store: { select: { name: true, timezone: true } } },
  });
  for (const b of dueDay3) {
    if (!isDaytime(now, b.store?.timezone)) continue;
    const claim = await db.borrowedGarment.updateMany({ where: { id: b.id, day3ReminderAt: null }, data: { day3ReminderAt: now } });
    if (claim.count !== 1) continue;
    const res = await sendBorrowedReminder(b, b.store?.name || "Classic Consigns by KYS", now).catch(() => ({ ok: false }));
    if (res.ok) borrowedSent++;
  }

  // ── Borrowed: on the return date (when one was set) ──
  const dueReturn = await db.borrowedGarment.findMany({
    where: { status: "OUT", email: { not: null }, returnReminderAt: null, returnDate: { not: null, lte: now }, ...scope },
    include: { store: { select: { name: true, timezone: true } } },
  });
  for (const b of dueReturn) {
    if (!isDaytime(now, b.store?.timezone)) continue;
    const claim = await db.borrowedGarment.updateMany({ where: { id: b.id, returnReminderAt: null }, data: { returnReminderAt: now } });
    if (claim.count !== 1) continue;
    // Don't send two reminders back to back (e.g. day-3 and return date coincide).
    const fresh = await db.borrowedGarment.findUnique({ where: { id: b.id }, select: { lastReminderAt: true } });
    if (fresh?.lastReminderAt && now.getTime() - fresh.lastReminderAt.getTime() < 1.5 * DAY_MS) continue;
    const res = await sendBorrowedReminder(b, b.store?.name || "Classic Consigns by KYS", now).catch(() => ({ ok: false }));
    if (res.ok) borrowedSent++;
  }

  // ── Sip & Shop event reminders (a couple of days before) ──
  const events = await db.sipShopEvent.findMany({
    where: { status: "SCHEDULED", email: { not: null }, reminderSentAt: null, ...scope },
    include: { store: { select: { name: true, address: true } } },
  });
  for (const ev of events) {
    if (!ev.email) continue;
    const remindAt = addDays(ev.eventDate, -SIP_REMINDER_DAYS_BEFORE);
    if (now < remindAt) continue;                 // too early
    if (now > addDays(ev.eventDate, 1)) continue;  // event already passed — skip stale reminder
    try {
      await sendSipShopReminderEmail({
        to: ev.email,
        hostName: ev.hostName,
        storeName: ev.store?.name || "Classic Consigns by KYS",
        dateLabel: ev.eventDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
        guests: ev.guests,
        address: ev.store?.address,
      });
      await db.sipShopEvent.update({ where: { id: ev.id }, data: { reminderSentAt: now } });
      sipSent++;
    } catch { /* retry next run */ }
  }

  return { layaway: layawaySent, borrowed: borrowedSent, sipshop: sipSent };
}
