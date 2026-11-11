import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { getConsignorThreadForStaff, postFromStaff } from "@/lib/messaging/external";
import { notifyStoreReply } from "@/lib/notifications";

export const runtime = "nodejs";

// Store-side view of one consignor's conversation. Requires external_comms.
// Goes through the messaging repository (§4a Layer 5) — no direct table access.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.EXTERNAL_COMMS);
  if (!g.ok) return g.res;
  const { id } = await params;
  const result = await getConsignorThreadForStaff(g.actor, id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ messages: result.messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.EXTERNAL_COMMS);
  if (!g.ok) return g.res;
  const { id } = await params;
  const { body } = await req.json().catch(() => ({}));
  try {
    const message = await postFromStaff(g.actor, { consignorId: id }, body);
    void notifyStoreReply(g.actor.storeId, message.threadId);
    return NextResponse.json({ message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not send." }, { status: 400 });
  }
}
