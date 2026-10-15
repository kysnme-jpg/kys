import { db } from "@/lib/db";
import { sendLayawayReminderEmail, sendBorrowedReturnReminderEmail } from "@/lib/email";

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

// Process any layaway payment reminders (15/30/45 days) and borrowed-garment
// return reminders that are now due and haven't been sent. Idempotent: each
// reminder is marked once sent, so this is safe to run repeatedly (from the
// daily cron and opportunistically when staff open the pages).
export async function processDueReminders(storeId?: string): Promise<{ layaway: number; borrowed: number }> {
  const now = new Date();
  let layawaySent = 0;
  let borrowedSent = 0;

  // ── Layaway payment reminders ──
  const layaways = await db.layaway.findMany({
    where: { status: "ACTIVE", email: { not: null }, ...(storeId ? { storeId } : {}) },
    include: { store: { select: { name: true } } },
  });

  for (const l of layaways) {
    if (!l.email) continue;
    const balance = Math.max(0, l.totalPrice - l.amountPaid);
    if (balance <= 0) continue; // fully paid — no reminders needed
    const storeName = l.store?.name || "Classic Consigns by KYS";

    const stages: { at: Date; sentField: "reminder15At" | "reminder30At" | "reminder45At"; which: string; amount: number }[] = [
      { at: addDays(l.startDate, 15), sentField: "reminder15At", which: "Payment 2 (due in 15 days)", amount: l.payment2 },
      { at: addDays(l.startDate, 30), sentField: "reminder30At", which: "Payment 3 (due in 30 days)", amount: l.payment3 },
      { at: addDays(l.startDate, 45), sentField: "reminder45At", which: "Final Payment (due in 45 days)", amount: l.finalPayment },
    ];

    for (const s of stages) {
      if ((l as any)[s.sentField]) continue;     // already sent
      if (now < s.at) continue;                   // not due yet
      try {
        await sendLayawayReminderEmail({
          to: l.email,
          buyerName: l.buyerName,
          storeName,
          which: s.which,
          amountDue: s.amount,
          balanceRemaining: balance,
        });
        await db.layaway.update({ where: { id: l.id }, data: { [s.sentField]: now } });
        layawaySent++;
      } catch { /* leave unsent; will retry next run */ }
    }
  }

  // ── Borrowed garment return reminders ──
  const borrowed = await db.borrowedGarment.findMany({
    where: { status: "OUT", email: { not: null }, returnDate: { not: null }, returnReminderAt: null, ...(storeId ? { storeId } : {}) },
    include: { store: { select: { name: true } } },
  });

  for (const b of borrowed) {
    if (!b.email || !b.returnDate) continue;
    if (now < b.returnDate) continue; // not due yet
    try {
      await sendBorrowedReturnReminderEmail({
        to: b.email,
        borrowerName: b.borrowerName,
        storeName: b.store?.name || "Classic Consigns by KYS",
        items: b.items,
        returnDate: b.returnDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
      });
      await db.borrowedGarment.update({ where: { id: b.id }, data: { returnReminderAt: now } });
      borrowedSent++;
    } catch { /* retry next run */ }
  }

  return { layaway: layawaySent, borrowed: borrowedSent };
}
