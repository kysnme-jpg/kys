<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keep the manuals up to date

This project ships user-facing documentation in `docs/`:
- `docs/USER_GUIDE.md` — for store staff (POS, inventory, consignors, etc.)
- `docs/ADMIN_GUIDE.md` — for the owner/admin (hosting, env vars, integrations, troubleshooting)

**Whenever you add or change a feature, workflow, setting, environment variable,
integration, or deployment step, update the relevant guide(s) in the SAME change**
so the manuals never drift from the platform. New feature → document it; renamed
or removed feature → fix/remove its section; new env var or setup step → add it
to the Admin Guide.

# Database changes go through migrations

The live database is managed with **Prisma migrations** (`prisma/migrations/`),
applied on deploy by `scripts/deploy-migrate.sh`. Do **not** use `prisma db push`
for schema changes — it drifts from the migration history. To change the schema:
edit `prisma/schema.prisma`, then generate a migration against a scratch Postgres
(`prisma migrate dev --name <change>`) and commit the new migration folder. Things
Prisma can't express in the schema (CHECK constraints, RLS) are hand-written
`.sql` inside a migration folder. Keep the generated client current with
`prisma generate`.

# Messaging isolation (§4a)

Internal (staff↔staff) and external (store↔consignor/customer) messaging are
physically separate. **All** messaging-table access goes through the repositories
in `src/lib/messaging/`; nothing else may query those tables. This is enforced by
`npm run check:messaging-isolation` (run in CI). Don't add direct `db.internal*`
/ `db.external*` access outside that directory.
