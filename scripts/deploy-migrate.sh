#!/usr/bin/env bash
#
# Phase 6 — safe migration adoption + deploy for the live database.
#
# This replaces the old `prisma db push` start step. It is written so the app
# can NEVER fail to boot because of migrations:
#
#   1. If the database already has application tables but no migration history
#      (it was first created with `db push`), adopt the baseline — record it as
#      already applied WITHOUT re-running its CREATE TABLEs. A brand-new empty
#      database skips this and lets the baseline run normally.
#   2. Apply any pending migrations with `prisma migrate deploy`.
#   3. If ANYTHING in steps 1–2 fails, fall back to `prisma db push` — exactly
#      the old behaviour — so a deploy is never worse than before this change.
#
# To roll back entirely, set the Railway startCommand back to:
#   npx prisma db push --accept-data-loss && npm run start
#
set -u

BASELINE="00000000000000_baseline"

run_migrations() {
  # Only adopt the baseline on an existing db-push database (tables but no
  # migration history). The detector prints "fresh" on any error, so we never
  # wrongly skip creating tables on a brand-new database.
  local state
  state="$(node scripts/needs-baseline-adopt.mjs 2>/dev/null || echo fresh)"
  if [ "$state" = "adopt" ]; then
    echo "[deploy] existing database detected — adopting migration baseline"
    npx prisma migrate resolve --applied "$BASELINE" || return 1
  fi
  npx prisma migrate deploy
}

if run_migrations; then
  echo "[deploy] database migrations applied (migrate deploy)"
else
  echo "[deploy] migrate deploy failed — falling back to 'db push' so the app still boots"
  npx prisma db push --accept-data-loss || { echo "[deploy] FATAL: db push also failed"; exit 1; }
fi

exec npm run start
