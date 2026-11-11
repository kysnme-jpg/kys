import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { listChannels, createChannel } from "@/lib/messaging/internal";

export const runtime = "nodejs";

// Staff group channels (internal_comms). Internal namespace — never reaches
// external conversations.
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  return NextResponse.json({ channels: await listChannels(g.actor) });
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => ({}));
  try {
    const channel = await createChannel(g.actor, body.name, body.description);
    return NextResponse.json({ channel }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not create channel." }, { status: 400 });
  }
}
