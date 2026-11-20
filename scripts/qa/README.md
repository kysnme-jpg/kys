# QA regression suite

End-to-end checks that drive a **running copy of the app against a scratch
database** — never point these at the live site: they create a store, staff,
consignors, sales, refunds and payouts.

## Run

1. Start an empty Postgres and apply migrations:
   `DATABASE_URL=postgresql://postgres@127.0.0.1:55440/qa npx prisma migrate deploy`
2. Build and start the app on port 3055 with that `DATABASE_URL`, plus
   `NEXTAUTH_SECRET`, `PORTAL_JWT_SECRET`, `NEXTAUTH_URL=http://localhost:3055`.
3. Run, in order (each builds on the state the previous one saved to
   `state.json`; reset the database between full runs):

   ```
   node scripts/qa/01-core.mjs           # setup, sign-in, items, sale, loyalty, refund, payout
   node scripts/qa/02-portal-comms.mjs   # portal, messaging isolation, preview, roles, tags, feed, team chat
   node scripts/qa/03-modules.mjs        # every page, booking, kiosk, layaway, borrowed, contracts, reports
   node scripts/qa/04-browser.cjs        # real browser: portal on a clean phone, every staff page
   node scripts/qa/05-roles-money.mjs    # report: what the lowest role is allowed to do
   ```

`06-reminders.mjs` checks the layaway (every 14 days) and borrowed (3 days)
reminder rules. It needs the app started with `EMAIL_DRY_RUN=1` (records sends
without emailing anyone), `CRON_SECRET=qa-cron` and
`DISABLE_REMINDER_SCHEDULER=1`, and `psql` access to the scratch database
(override with `QA_PSQL`).

`07-split.mjs` checks splitting an item into pieces (pieces, original removed,
selling one piece credits the consignor, and the safety rules).

`08-item-fees.mjs` checks consignor charges on items (deducted only when the
item sells, given back on a refund and charged again on resale, added/removed
after a sale, manual and bulk "sold", shared across split pieces, and the rules).

`09-day-sales.mjs` checks the POS "Sold today" list (register, hand-marked and
store-owned sales with consignor names, refunds flagged and left out of the
total, other days, and sign-in).

Set `QA_BASE_URL` to use a different port. Every script prints `PASS`/`FAIL`
lines and a summary; `05` is informational (it reports, it does not assert).
