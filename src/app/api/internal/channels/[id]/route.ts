import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { getChannel, postToChannel } from "@/lib/messaging/internal";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  const { id } = await params;
  const result = await getChannel(g.actor, id);
  if (!result) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  const { id } = await params;
  const { body } = await req.json().catch(() => ({}));
  try {
    const message = await postToChannel(g.actor, id, body);
    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not send." }, { status: 400 });
  }
}
