import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { listDirectThreads, startDirectThread } from "@/lib/messaging/internal";

export const runtime = "nodejs";

// Direct (staff-to-staff) conversations (internal_comms).
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  return NextResponse.json({ threads: await listDirectThreads(g.actor) });
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => ({}));
  const userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
  try {
    const thread = await startDirectThread(g.actor, userIds);
    return NextResponse.json({ thread }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not start conversation." }, { status: 400 });
  }
}
