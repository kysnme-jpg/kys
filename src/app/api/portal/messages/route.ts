import { NextRequest, NextResponse } from "next/server";
import { requireExternal } from "@/lib/authz";
import { getMyThread, postFromExternal } from "@/lib/messaging/external";

export const runtime = "nodejs";

// Portal (EXTERNAL): the consignor's own conversation with the store.
// All table access is inside the messaging repository (§4a Layer 5).
export async function GET(req: NextRequest) {
  const g = await requireExternal(req);
  if (!g.ok) return g.res;
  const { messages } = await getMyThread(g.actor);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const g = await requireExternal(req);
  if (!g.ok) return g.res;
  const { body } = await req.json().catch(() => ({}));
  try {
    const message = await postFromExternal(g.actor, body);
    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not send." }, { status: 400 });
  }
}
