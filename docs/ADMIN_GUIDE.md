# Classic Consigns by KYS — Admin & Operations Guide

For the store owner / administrator. Covers hosting, configuration, accounts,
security, integrations, data import/export, backups, and troubleshooting.

---

## 1. Architecture at a glance

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, TypeScript), React 19 |
| Database | PostgreSQL via Prisma 7 (pg driver adapter) |
| Auth (staff) | NextAuth v5 (JWT sessions, credentials) |
| Auth (consignor/dealer portal) | separate JWT (`jose`) |
| Hosting | Railway (app + Postgres + a Volume for photos) |
| Photo storage | Railway Volume (served via `/api/photos`) |
| Payments | Clover REST API |
| Email | Resend |
| AI item entry | Anthropic Claude (`claude-haiku-4-5`) vision |
| Barcodes | Code128 labels via JsBarcode |

The code lives in the GitHub repo and **auto-deploys to Railway** on every push
to the connected branch.

---

## 2. Hosting on Railway

The project (e.g. "patient-dream") contains two services:
1. **App service** — deployed from the GitHub repo. Has a **Volume** mounted
   (e.g. at `/data`) for item photos.
2. **Postgres** — the database.

**Build/run config** lives in `railway.json`:
- Build: Nixpacks, `npm run build`.
- Start: `npx prisma db push --accept-data-loss && npm run start`
  (syncs the database schema, then starts the server).
- Healthcheck path: `/login`.

> The app binds to Railway's `$PORT` automatically. The Prisma client is created
> lazily, so the **build** does not require a database connection, but the
> **running app** and the start command do (via `DATABASE_URL`).

### Deploying changes
Push to the connected branch → Railway rebuilds and redeploys automatically.
Watch the **Deployments** tab; a healthy deploy ends **Active / green**.

---

## 3. Environment variables

Set these on the **app service → Variables** tab. Required unless noted.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection. Use the reference `${{Postgres.DATABASE_URL}}`. **Must be set before the first deploy.** |
| `NEXTAUTH_URL` | The app's public URL, e.g. `https://your-store.up.railway.app`. |
| `NEXTAUTH_SECRET` | Random secret for staff auth. Generate: `openssl rand -base64 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). |
| `PORTAL_JWT_SECRET` | Random secret for consignor/dealer portal tokens. |
| `ANTHROPIC_API_KEY` | _Optional._ Enables AI item entry. From console.anthropic.com. |
| `CLOVER_API_KEY` / `CLOVER_MERCHANT_ID` | _Optional._ Enables Clover card orders. |
| `CLOVER_API_BASE` | _Optional._ `https://sandbox.dev.clover.com` for sandbox testing; omit for production. |
| `RESEND_API_KEY` / `EMAIL_FROM` | _Optional._ Enables outbound email (contracts, payouts, appointments, layaway, borrowed). |
| `BOOKING_NOTIFY_EMAIL` | _Optional._ Where new-appointment alerts go (falls back to store email, then kimberly@classicconsigns.com). |
| `CRON_SECRET` | _Optional._ Secret that protects `/api/cron/reminders` for the daily layaway/return reminder runner. |
| `SHOPIFY_WEBHOOK_SECRET` | _Optional._ Verifies Shopify webhooks. |
| `RESET_TOKEN` | _Optional/temporary._ Enables the `/reset` password-reset page while set. Remove when not in use. |

A volume at a mount path (Railway sets `RAILWAY_VOLUME_MOUNT_PATH`) stores
photos under `<mount>/uploads`. `UPLOAD_DIR` can override the location.

---

## 4. First-run setup (new deployment)

1. Set **all required** env vars (above), especially `DATABASE_URL`,
   `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `PORTAL_JWT_SECRET`.
2. Attach a **Volume** to the app service (e.g. mount `/data`).
3. Deploy; wait for **Active**.
4. Open **your site `/api/setup`** — it should return `{"needsSetup":true}`.
5. Open **your site `/setup`** → enter store name, your email, a password →
   **Create my account**. This creates the owner account and some starter
   categories, then **locks itself**.
6. Sign in at `/login`.

---

## 5. Accounts & roles

Roles: **OWNER**, **MANAGER**, **EMPLOYEE** (set on the `User` record).

- **Owner/Manager** can change store settings, manage API keys & webhooks,
  import data, and edit store/Clover settings.
- The first owner is created via `/setup`.
- There is no staff-invite UI yet. To add staff, create a `User` row in the
  database (see "Direct database access") with the store's `storeId`, a
  bcrypt-hashed password, and the desired role.

### Resetting a password
1. Add a temporary env var `RESET_TOKEN` = any random string.
2. Wait for redeploy, then open **your site `/reset`**.
3. Enter the token, the account email, and a new password → **Update password**.
4. **Remove the `RESET_TOKEN` variable** afterward to disable the page.

---

## 6. Store configuration (Settings)

**Settings** (sidebar) covers:
- **Store Information** — name, email, phone, **tax rate** (entered as %),
  currency. Used across the app (e.g. POS tax).
- **Clover** — merchant ID + API key (stored in the database; env vars also
  work as a fallback).
- **Online Shop** — your public `/shop` URL.
- **Categories** — add/manage item categories.
- **API Keys** — generate keys for external integrations (shown once).
- **Webhooks** — register endpoints to receive events (sale.created, item.sold,
  contract.signed, etc.), HMAC-signed.
- **Discount Rules** — percentage or fixed-amount rules, optional promo codes.
- **Contract Template** — edit the consignment agreement. Placeholders:
  `{{storeName}}`, `{{consignorName}}`, `{{splitPercent}}`.

### Admin — employee work log (`/admin`)

The **Admin** tab (next to Items/Contracts, at `/admin`) is a lightweight log of
employee **hours and payouts** — date, employee name, phone, work hours, payout,
and an optional note. Staff can **Add** entries and **Edit/Delete** existing
ones. It's backed by the `WorkLog` table (one row per entry, scoped to the
store); no external payroll integration is involved. It is not a payroll
processor — it's a record you keep for your own bookkeeping.

---

### Consignment appointments (`/book` public page)

Prospective consignors book drop-off appointments at the **public** page
**`/book`** (no login). Staff manage them under **People → Appointments**
(`/appointments`).

- Scheduling rules live in `src/lib/appointments.ts` — `SLOT_TIMES` (the four
  40-minute Saturday slots), `SLOT_MINUTES`, and `upcomingSaturdays()`. Edit
  `SLOT_TIMES` there to change times or the number of slots per day.
- Data: `ConsignAppointment` (one row per booked slot; unique per
  store+date+slot prevents double-booking) and `ConsignBlockedDate` (a blocked
  Saturday). Both are created by `prisma db push` on deploy.
- `/book` and `/api/book` are in the middleware `PUBLIC_PATHS` allow-list so
  they're reachable without a login.
- **Booking notifications:** every online booking emails the store. The
  recipient is `BOOKING_NOTIFY_EMAIL` (env var) if set, otherwise the store email
  from Settings, otherwise `kimberly@classicconsigns.com`. Set
  `BOOKING_NOTIFY_EMAIL` to send alerts somewhere specific. The consignor also
  gets a confirmation if they entered an email.
- **Test email:** People → Appointments has a **Send test email** button
  (`POST /api/appointments/test-email`) that returns the real Resend result for
  troubleshooting delivery.

### Layaway & Borrowed agreements

Two more People tabs: **Layaway** (`/layaway`) and **Borrowed** (`/borrowed`).

- Data: `Layaway` and `BorrowedGarment` tables (created by `prisma db push`).
- On creation, the customer/borrower is emailed the agreement if an email is
  provided (layaway → agreement + payment schedule; borrowed → item list +
  terms).
- **Reminders:** layaway payment reminders fire at **15 / 30 / 45 days** from the
  start date; borrowed-garment **return reminders** fire on/after the return
  date. Logic lives in `src/lib/reminders.ts` and is idempotent (each reminder is
  timestamped once sent).
- Reminders run two ways:
  1. **Opportunistically** whenever staff open the Layaway/Borrowed pages (the
     list endpoints call the processor). Good enough if staff visit regularly.
  2. **Daily** via `POST /api/cron/reminders`, protected by the `CRON_SECRET`
     env var (send `Authorization: Bearer <CRON_SECRET>` or `?secret=`). If
     `CRON_SECRET` is unset the endpoint is disabled (503).

### Sip & Shop events

People tab **Sip & Shop** (`/sip-shop`, staff) plus a **public** request page at
`/sip-and-shop` (no login). Model: `SipShopEvent`. Events run 7–10 PM.

- Staff schedule events on a calendar; the host gets a confirmation email (date,
  7–10 PM, guests, perks) when an email is provided, and a reminder email
  ~2 days before (see `SIP_REMINDER_DAYS_BEFORE` in `src/lib/reminders.ts`).
- The public page lets customers request their own date; it creates a
  `SipShopEvent`, emails the customer a confirmation, and notifies the store
  (`BOOKING_NOTIFY_EMAIL` → store email → kimberly@classicconsigns.com).
- `/sip-and-shop` and `/api/sip-and-shop` are in the middleware public allow-list.

### Kiosk customer sign-in (`/welcome`)

Public kiosk page at `/welcome` (no login) for a tablet to replace the paper
guest book. `POST /api/checkin` creates or updates a `Customer` (matched by
email or phone to avoid duplicates). Added `Customer.birthday` ("MM-DD") and
`Customer.source` fields. `/welcome` and `/api/checkin` are in the middleware
public allow-list. Put the tablet in kiosk/Guided-Access mode on this page so
customers can't reach the staff dashboard.

**To enable the daily runner (recommended):**
1. Set a `CRON_SECRET` env var in Railway (any long random string).
2. In GitHub → repo **Settings → Secrets and variables → Actions**, add two
   repository secrets:
   - `APP_URL` = your live site, e.g. `https://data-production-5b03.up.railway.app`
   - `CRON_SECRET` = the same value as in Railway
3. The workflow `.github/workflows/reminders.yml` runs daily (14:00 UTC) and can
   be run manually from the **Actions** tab (Run workflow). It no-ops if the
   secrets aren't set.

## 7. Integrations

### Clover (card payments)
Set `CLOVER_API_KEY` + `CLOVER_MERCHANT_ID` (env or Settings). Use
`CLOVER_API_BASE=https://sandbox.dev.clover.com` for sandbox testing.
**Note:** the app creates Clover **orders**; the actual card capture happens on
a Clover **device/terminal** tied to the merchant — full in-app card capture is
not yet implemented.

**Live Clover transactions on Insights:** Store Insights shows a **Clover Card
Transactions** panel (today + last 30 days + a recent list) that pulls real
payments from Clover and auto-refreshes every 60s. Powered by
`GET /api/clover/transactions` → `CloverClient.listPayments`
(`/v3/merchants/{mId}/payments`). The API token must have **Payments: Read**
permission (Clover dashboard → Setup → API Tokens); otherwise the panel shows a
permission error. This is separate from the app's own POS revenue numbers (which
only reflect sales rung up inside the app).

### Resend (email)
Set `RESEND_API_KEY` and `EMAIL_FROM` (verified domain recommended). Powers
contract links, payout notifications, welcome emails, and **appointment
confirmations** (sent when a consignor books at `/book` or staff add a booking
with an email). If `RESEND_API_KEY` is unset, bookings still work — no email is
sent.

**Test your email setup** with the included script — it sends a sample
appointment confirmation so you can confirm the key/domain work before going
live:

```bash
# locally
RESEND_API_KEY=re_xxx EMAIL_FROM="Classic Consigns by KYS <kimberly@classicconsigns.com>" \
  node scripts/send-test-email.mjs you@example.com

# on Railway (RESEND_API_KEY / EMAIL_FROM already set) — from the service shell:
node scripts/send-test-email.mjs you@example.com
```

If Resend returns a domain error, the sender domain isn't verified yet — verify
it under Resend → Domains (add the SPF/DKIM DNS records), or point `EMAIL_FROM`
at an already-verified address.

**DMARC (deliverability):** in addition to Resend's SPF/DKIM records, add a
DMARC record at the domain's DNS to improve inbox placement and satisfy
Gmail/Yahoo sender requirements:

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:kimberly@classicconsigns.com` |

`p=none` is monitor-only (no effect on mail flow); it can be tightened to
`p=quarantine` later once reports look clean. Verify at whatsmydns.net by
looking up `_dmarc.classicconsigns.com` (TXT).

### Anthropic / Claude (AI item entry)
Set `ANTHROPIC_API_KEY`. The add-item photo analysis uses `claude-haiku-4-5`.
Cost is well under a cent per item. If unset, AI entry simply returns a 503 and
everything else works.

### Shopify (webhooks, inbound)
Set `SHOPIFY_WEBHOOK_SECRET`; point Shopify order webhooks at
`/api/webhooks/shopify`. Incoming orders mark matched items sold and credit the
consignor.

### Outbound webhooks / API keys
Configure in **Settings**. API requests authenticate with a `Bearer cp_live_…`
key; only a SHA-256 hash is stored.

---

## 8. Importing data

Owners/managers upload prepared JSON at **your site `/import`**:
- `{ consignors: [...] }` — creates consignors (matched by email) and their
  items (Active, priced from the sheet, default 50% split).
- `{ customers: [...] }` — creates customers (matched by email).

Both are idempotent (safe to re-run; existing records are skipped). Preparing
these files from spreadsheets is typically done by cleaning the sheet into the
expected JSON shape; ask the maintainer to generate the import file from a
new spreadsheet.

---

## 9. Data export & reporting

**Reports → Export** produces CSVs for Sales, Inventory, Consignors, and Ledger
(optional date range) for bookkeeping and accounting.

---

## 10. Backups & data safety

- **Database:** enable Railway's Postgres **backups/snapshots**. The database
  holds all consignors, customers, items, sales, ledger, payouts, and contracts.
- **Photos:** the Railway **Volume** holds item photos — enable volume
  snapshots. Photos are **not** in git or the database.
- **Deletions are protected:** consignors/items with sales history can't be
  deleted.

> The start command uses `prisma db push --accept-data-loss`. The current schema
> is additive, so this is a no-op in practice. Before making a **destructive**
> schema change against live data, take a database backup first, and consider
> switching to committed Prisma migrations (`prisma migrate`).

---

## 11. Direct database access

- Browse/edit data with Prisma Studio locally:
  `DATABASE_URL="…" npx prisma studio`.
- Railway also provides a **Console** and a database connection string for the
  Postgres service.

---

## 12. Local development

See `LOCAL_DEV.md` for the full local setup (clone, `.env`, `docker compose up`
for a local Postgres, `npm run db:push`, `npm run db:seed`, `npm run dev`).

---

## 13. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Build fails with `P2038 … driver adapter` | A DB route evaluated at build time without `DATABASE_URL`. The client is lazy now; ensure you're on current code. |
| "Application failed to respond" after deploy | The start command failed — check **Deploy Logs**. Often the DB migration step or a bad start command. |
| Every page 500s | Missing `NEXTAUTH_SECRET`, or NextAuth can't trust the host — `trustHost` is enabled; make sure the secret is set. |
| Login says "invalid email or password" with a correct password | Check the account exists (`/api/setup` → `needsSetup:false`). If needed, reset via `/reset`. |
| Login succeeds then bounces to `/login` | Session cookie not seen on navigation — the app uses a hard navigation after login to prevent this; ensure current code. |
| `/api/setup` returns 500 | Database has no tables / can't connect. The start command runs `prisma db push`; verify `DATABASE_URL`. |
| AI item entry returns 503 | `ANTHROPIC_API_KEY` not set (optional feature). |
| Photos don't upload/show | Volume not attached, or `/api/photos` blocked. Ensure a Volume is mounted. |
| Card payments don't charge | Expected — Clover orders are created, but card capture needs a Clover device. |

**Reading logs:** Railway → app service → latest deployment → **View logs** →
**Deploy Logs**. Use the filter box to find specific text.

---

## 14. Security checklist

- [ ] `NEXTAUTH_SECRET` and `PORTAL_JWT_SECRET` are strong, unique random values.
- [ ] `RESET_TOKEN` is **removed** when not actively resetting a password.
- [ ] Database and Volume backups are enabled.
- [ ] The owner password was changed from any initial value.
- [ ] Secrets are only in Railway Variables (never committed to git).
- [ ] API keys are rotated if exposed.

---

_See `USER_GUIDE.md` for day-to-day staff instructions._
