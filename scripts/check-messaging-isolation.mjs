#!/usr/bin/env node
/**
 * §4a Layer 5 enforcement: messaging tables may be accessed ONLY through the
 * repository in src/lib/messaging/. This script greps src/ for Prisma model
 * accessors of the messaging tables and fails if any appear outside that dir.
 *
 * Run: npm run check:messaging-isolation   (wire into CI later)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ALLOWED_PREFIX = join("src", "lib", "messaging");

// Prisma client accessors for messaging models (added in later phases).
const FORBIDDEN = [
  "db.externalThread", "db.externalMessage", "db.externalInternalNote",
  "db.internalThread", "db.internalMessage", "db.internalParticipant", "db.internalChannel",
  "db.ownerThread",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

let violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (rel.startsWith(ALLOWED_PREFIX)) continue;
  const text = readFileSync(file, "utf8");
  for (const token of FORBIDDEN) {
    if (text.includes(token)) violations.push(`${rel}: uses ${token}`);
  }
}

if (violations.length) {
  console.error("✖ Messaging isolation violated — access messaging tables only via src/lib/messaging/:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}
console.log("✓ Messaging isolation OK (no direct messaging-table access outside src/lib/messaging/).");
