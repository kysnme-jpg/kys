import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import {
  listThreadsForStaff, getThreadForStaff, postFromStaff, addInternalNote,
} from "@/lib/messaging/external";
import { notifyStoreReply } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Staff unified inbox for EXTERNAL conversations (§4). Internal namespace,
 * requires external_comms. Everything runs through the messaging repository
 * (§4a Layer 5); the actor is server-resolved (Layer 1). This route touches
 * external conversations only — it can never reach internal staff↔staff threads.
 */
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.EXTERNAL_COMMS);
  if (!g.ok) return g.res;

  const threadId = new URL(req.url).searchParams.get("threadId");
  if (threadId) {
    const thread = await getThreadForStaff(g.actor, threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    return NextResponse.json(thread);
  }

  const threads = await listThreadsForStaff(g.actor);
  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.EXTERNAL_COMMS);
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "note" ? "note" : "reply";
  try {
    if (kind === "note") {
      if (!body.threadId) return NextResponse.json({ error: "threadId required." }, { status: 400 });
      const note = await addInternalNote(g.actor, String(body.threadId), String(body.body || ""));
      return NextResponse.json({ note }, { status: 201 });
    }
    const message = await postFromStaff(
      g.actor,
      { threadId: body.threadId, consignorId: body.consignorId, customerId: body.customerId },
      String(body.body || "")
    );
    void notifyStoreReply(g.actor.storeId, message.threadId);
    return NextResponse.json({ message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not send." }, { status: 400 });
  }
}
