# Running ConsignPro locally

A step-by-step guide to run the full platform on your own machine. Your local
setup is completely separate from the production (Railway) deployment — nothing
you do here touches live data until you `git push`.

## Prerequisites

- **Node 22** — https://nodejs.org
- **Git**
- **Docker Desktop** (for the local database) — https://www.docker.com/products/docker-desktop
  (No Docker? See "Without Docker" at the bottom.)

## 1. Clone and install

```bash
git clone https://github.com/kysnme-jpg/kys.git
cd kys
git checkout claude/bold-archimedes-anke3c
npm install
```

## 2. Create your `.env`

Generate two secrets (works on Windows, macOS, and Linux):

```bash
node -e "console.log('NEXTAUTH_SECRET='+require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('PORTAL_JWT_SECRET='+require('crypto').randomBytes(32).toString('base64'))"
```

Create a file named `.env` in the project root:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/consignpro"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<paste the first generated value>"
PORTAL_JWT_SECRET="<paste the second generated value>"

# Optional — leave blank to disable that feature locally:
ANTHROPIC_API_KEY=""     # AI photo item-entry (claude-haiku-4-5)
CLOVER_API_KEY=""        # card payments
CLOVER_MERCHANT_ID=""
RESEND_API_KEY=""        # transactional email
EMAIL_FROM="ConsignPro <noreply@localhost>"
```

`.env` is gitignored — your secrets stay on your machine. Photo uploads save to
a local `.uploads/` folder automatically; no extra setup needed.

## 3. Start the database

```bash
docker compose up -d
```

This runs Postgres 16 on `localhost:5432` with the database, user, and password
that match the `DATABASE_URL` above.

## 4. Create the tables and seed test data

```bash
npm run db:push
npm run db:seed
```

Seed login: **owner@myconsignshop.com** / **password123**

## 5. Run the app

```bash
npm run dev
```

- App: http://localhost:3000 (redirects to `/login`)
- Public storefront: http://localhost:3000/shop

## Handy commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start the local database |
| `docker compose down` | Stop the database (keeps data) |
| `docker compose down -v` | Stop and **delete** all local data |
| `npm run db:studio` | Open Prisma Studio to browse/edit the database |
| `npm run db:push` | Re-sync the schema after changing `prisma/schema.prisma` |
| `npm run db:seed` | Re-seed sample data |

## Without Docker

Install Postgres natively (https://www.postgresql.org/download/), create a
database named `consignpro`, then update the user/password in `DATABASE_URL`
to match your install. The rest of the steps are identical.
