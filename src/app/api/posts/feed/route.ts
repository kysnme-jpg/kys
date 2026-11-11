import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveActor } from "@/lib/authz";
import { feedWhereForActor } from "@/lib/posts";
import { getActorTagNames } from "@/lib/tags";

export const runtime = "nodejs";

/**
 * Content feed for whoever is asking (§2). The actor is resolved on the server
 * (staff session or portal JWT) — never from the client — and only posts whose
 * audience includes that actor, inside their publish window, are returned.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const actorTags = await getActorTagNames(actor);
  const posts = await db.post.findMany({
    where: feedWhereForActor(actor, actorTags),
    orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true, type: true, title: true, body: true, imageUrl: true,
      linkUrl: true, linkLabel: true, rsvpEnabled: true,
      publishAt: true, createdAt: true,
      rsvps: {
        where: actor.class === "INTERNAL"
          ? { userId: actor.userId }
          : { consignorId: actor.consignorId },
        select: { response: true },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      body: p.body,
      imageUrl: p.imageUrl,
      linkUrl: p.linkUrl,
      linkLabel: p.linkLabel,
      rsvpEnabled: p.rsvpEnabled,
      publishAt: p.publishAt,
      createdAt: p.createdAt,
      myRsvp: p.rsvps[0]?.response || null,
    })),
  });
}
