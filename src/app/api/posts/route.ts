import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { validateAudience, type AudienceScope } from "@/lib/posts";
import { notifyNewPost } from "@/lib/notifications";

export const runtime = "nodejs";

const POST_TYPES = ["ANNOUNCEMENT", "NEWS", "EVENT", "PROMOTION"];
const STATUSES = ["DRAFT", "PUBLISHED", "RETIRED"];

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// Staff with CONTENT_ADMIN: full list of posts (any status) for management.
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;

  const posts = await db.post.findMany({
    where: { storeId: g.actor.storeId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { rsvps: true } } },
  });

  return NextResponse.json({ posts });
}

// Staff with CONTENT_ADMIN: create a post.
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const type = POST_TYPES.includes(body.type) ? body.type : "ANNOUNCEMENT";
  const status = STATUSES.includes(body.status) ? body.status : "DRAFT";

  const audienceErr = validateAudience({ scope: body.audienceScope, role: body.audienceRole, tag: body.audienceTag });
  if (audienceErr) return NextResponse.json({ error: audienceErr }, { status: 400 });

  const post = await db.post.create({
    data: {
      storeId: g.actor.storeId,
      authorUserId: g.actor.class === "INTERNAL" ? g.actor.userId : null,
      type,
      title: title.slice(0, 200),
      body: String(body.body || "").slice(0, 8000),
      imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 1000) : null,
      linkUrl: body.linkUrl ? String(body.linkUrl).slice(0, 1000) : null,
      linkLabel: body.linkLabel ? String(body.linkLabel).slice(0, 100) : null,
      rsvpEnabled: !!body.rsvpEnabled,
      audienceScope: body.audienceScope as AudienceScope,
      audienceRole: body.audienceScope === "INTERNAL_ROLE" ? String(body.audienceRole) : null,
      audienceTag: body.audienceScope === "TAG" ? String(body.audienceTag) : null,
      status,
      publishAt: parseDate(body.publishAt),
      expiresAt: parseDate(body.expiresAt),
    },
  });

  if (post.status === "PUBLISHED") {
    void notifyNewPost(g.actor.storeId, { title: post.title, body: post.body, audienceScope: post.audienceScope, audienceRole: post.audienceRole, audienceTag: post.audienceTag });
  }
  return NextResponse.json({ post }, { status: 201 });
}
