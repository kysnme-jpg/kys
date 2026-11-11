import { NextRequest, NextResponse } from "next/server";
import { resolveActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { unreadCountForStaff } from "@/lib/messaging/external";
import { unreadCountInternal } from "@/lib/messaging/internal";
import { feedWhereForActor } from "@/lib/posts";
import { getActorTagNames } from "@/lib/tags";

export const runtime = "nodejs";

/**
 * The resolved actor's own identity + permissions. Used by the UI to decide
 * which staff-only controls to show. Authorization is still enforced per-route
 * on the server — this is only for hiding controls the actor can't use.
 *
 * `unreadExternal` is a COUNT only — never any message content (§4a Layer 7).
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const permissions = Array.from(actor.permissions);
  let unreadExternal = 0;
  let unreadInternal = 0;
  if (actor.class === "INTERNAL" && permissions.includes("external_comms")) {
    unreadExternal = await unreadCountForStaff(actor);
  }
  if (actor.class === "INTERNAL" && permissions.includes("internal_comms")) {
    unreadInternal = await unreadCountInternal(actor);
  }

  // Latest post this actor can see — the client compares against a locally
  // stored "last seen" to show a "new" dot on the feed.
  let latestPostAt: Date | null = null;
  try {
    const actorTags = await getActorTagNames(actor);
    const latest = await db.post.findFirst({
      where: feedWhereForActor(actor, actorTags),
      orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
      select: { publishAt: true, createdAt: true },
    });
    if (latest) latestPostAt = latest.publishAt || latest.createdAt;
  } catch {}

  return NextResponse.json({
    class: actor.class,
    role: actor.role,
    displayName: actor.displayName,
    permissions,
    unreadExternal,
    unreadInternal,
    latestPostAt,
  });
}
