import { NextRequest, NextResponse } from "next/server";
import { processDueReminders } from "@/lib/reminders";

// Daily reminder runner. Protect with CRON_SECRET: callers must send
// Authorization: Bearer <CRON_SECRET>, or ?secret=<CRON_SECRET>.
// If CRON_SECRET is unset, the endpoint is disabled (returns 503) to avoid
// being publicly triggerable.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const qs = new URL(req.url).searchParams.get("secret") || "";
  return bearer === secret || qs === secret;
}

async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }
