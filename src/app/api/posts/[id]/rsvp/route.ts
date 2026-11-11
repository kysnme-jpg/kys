import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveActor } from "@/lib/authz";
import { feedWhereForActor } from "@/lib/posts";
import { getActorTagNames } from "@/lib/tags";

export const runtime = "nodejs";

const RESPONSES = ["YES", "NO", "MAYBE"];

/**
 * RSVP to a post (§2). Any resolved actor who can SEE the post may RSVP. The
 * actor is server-resolved; the RSVP is keyed to their identity so one person =
 * one response.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await resolveActor(req);
  if (!actor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const response = RESPONSES.includes(body.response) ? body.response : "YES";

  // The post must be one this actor can actually see, and must accept RSVPs.
  const actorTags = await getActorTagNames(actor);
  const post = await db.post.findFirst({
    where: { id, rsvpEnabled: true, ...feedWhereForActor(actor, actorTags) },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (actor.class === "INTERNAL") {
    await db.postRsvp.upsert({
      where: { postId_userId: { postId: id, userId: actor.userId } },
      create: { postId: id, actorClass: "INTERNAL", userId: actor.userId, response },
      update: { response },
    });
  } else {
    await db.postRsvp.upsert({
      where: { postId_consignorId: { postId: id, consignorId: actor.consignorId } },
      create: { postId: id, actorClass: "EXTERNAL", consignorId: actor.consignorId, response },
      update: { response },
    });
  }

  return NextResponse.json({ ok: true, response });
}
