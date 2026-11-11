import { NextRequest, NextResponse } from "next/server";
import { resolveActor } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * The resolved actor's own identity + permissions. Used by the UI to decide
 * which staff-only controls to show. Authorization is still enforced per-route
 * on the server — this is only for hiding controls the actor can't use.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({
    class: actor.class,
    role: actor.role,
    displayName: actor.displayName,
    permissions: Array.from(actor.permissions),
  });
}
