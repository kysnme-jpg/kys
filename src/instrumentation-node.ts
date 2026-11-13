/**
 * In-process reminder scheduler.
 *
 * Checks for due customer reminders (layaway every 14 days, borrowed items after
 * 3 days, Sip & Shop) shortly after the server starts and then every 30 minutes,
 * so reminders go out on their own without an external cron or anyone opening a
 * page. processDueReminders is idempotent and claims each reminder in the
 * database before sending, so it is safe alongside the cron endpoint and across
 * restarts. Set DISABLE_REMINDER_SCHEDULER=1 to turn this off.
 */
const INTERVAL_MS = 30 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 90 * 1000;

const g = globalThis as unknown as { __reminderScheduler?: boolean };

async function tick() {
  try {
    const { processDueReminders } = await import("@/lib/reminders");
    const r = await processDueReminders();
    if (r.layaway || r.borrowed || r.sipshop) {
      console.log(`[reminders] sent — layaway: ${r.layaway}, borrowed: ${r.borrowed}, sip & shop: ${r.sipshop}`);
    }
  } catch (err) {
    console.error("[reminders] run failed:", (err as Error)?.message || err);
  }
}

if (!g.__reminderScheduler && process.env.DATABASE_URL && process.env.DISABLE_REMINDER_SCHEDULER !== "1") {
  g.__reminderScheduler = true;
  setTimeout(tick, FIRST_RUN_DELAY_MS).unref?.();
  setInterval(tick, INTERVAL_MS).unref?.();
}
export {};
