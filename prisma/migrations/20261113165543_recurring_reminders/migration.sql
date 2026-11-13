-- AlterTable
ALTER TABLE "BorrowedGarment" ADD COLUMN     "day3ReminderAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Layaway" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill so switching to the new schedule does not send a burst of emails to
-- existing customers the moment it deploys:
--  * Layaways: treat every 14-day period that has already passed as handled, so
--    the next automatic reminder is the NEXT 14-day mark from the start date.
UPDATE "Layaway"
SET "reminderCount" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - "startDate")) / 1209600))::int,
    "lastReminderAt" = GREATEST("reminder15At", "reminder30At", "reminder45At");

--  * Borrowed items already out for 3+ days: mark the 3-day reminder as handled
--    (staff can still send one by hand). Newer and future borrows get it
--    automatically.
UPDATE "BorrowedGarment"
SET "day3ReminderAt" = NOW()
WHERE "dateBorrowed" <= NOW() - INTERVAL '3 days';

UPDATE "BorrowedGarment" SET "lastReminderAt" = "returnReminderAt" WHERE "returnReminderAt" IS NOT NULL;
