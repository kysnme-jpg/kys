import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { listDirectory } from "@/lib/messaging/internal";

export const runtime = "nodejs";

// Staff directory — who you can start a direct conversation with.
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.INTERNAL_COMMS);
  if (!g.ok) return g.res;
  return NextResponse.json({ staff: await listDirectory(g.actor) });
}
