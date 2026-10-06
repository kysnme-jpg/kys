# ConsignPro — Admin & Operations Guide

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
| `RESEND_API_KEY` / `EMAIL_FROM` | _Optional._ Enables outbound email (contracts, payouts). |
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

---

## 7. Integrations

### Clover (card payments)
Set `CLOVER_API_KEY` + `CLOVER_MERCHANT_ID` (env or Settings). Use
`CLOVER_API_BASE=https://sandbox.dev.clover.com` for sandbox testing.
**Note:** the app creates Clover **orders**; the actual card capture happens on
a Clover **device/terminal** tied to the merchant — full in-app card capture is
not yet implemented.

### Resend (email)
Set `RESEND_API_KEY` and `EMAIL_FROM` (verified domain recommended). Powers
contract links, payout notifications, and welcome emails.

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
