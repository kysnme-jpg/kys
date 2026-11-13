import { NextRequest, NextResponse } from "next/server";
import { requireInternal } from "@/lib/authz";
import { sendTestStoreAlert } from "@/lib/notifications";

export const runtime = "nodejs";

// Send a sample "new message" alert to the store's alert address and report
// exactly what happened, so the owner can confirm delivery. Owner/manager only.
export async function POST(req: NextRequest) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  if (g.actor.role !== "owner" && g.actor.role !== "manager") return NextResponse.json({ error: "Owner or manager only." }, { status: 403 });
  const result = await sendTestStoreAlert(g.actor.storeId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
