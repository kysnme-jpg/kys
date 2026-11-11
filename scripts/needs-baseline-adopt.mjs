#!/usr/bin/env node
/**
 * Phase 6 helper. Prints "adopt" when the database must adopt the Prisma
 * baseline — i.e. it already has application tables (it was first created with
 * `db push`) but no `_prisma_migrations` history yet. Prints "fresh" when it is
 * an empty database (let `migrate deploy` run the baseline normally) or already
 * has migration history. Never throws a non-zero exit for an expected state; on
 * any connection error it prints "fresh" so the caller falls through to the
 * normal migrate/db-push path.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.log("fresh"); process.exit(0); }

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const hist = await client.query("SELECT to_regclass('public._prisma_migrations') AS t");
  const hasHistory = hist.rows[0].t !== null;
  const app = await client.query("SELECT to_regclass('public.\"Store\"') AS t");
  const hasAppTables = app.rows[0].t !== null;
  console.log(!hasHistory && hasAppTables ? "adopt" : "fresh");
} catch {
  console.log("fresh");
} finally {
  try { await client.end(); } catch {}
}
