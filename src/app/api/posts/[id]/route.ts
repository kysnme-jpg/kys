import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { validateAudience, type AudienceScope } from "@/lib/posts";

export const runtime = "nodejs";

const POST_TYPES = ["ANNOUNCEMENT", "NEWS", "EVENT", "PROMOTION"];
const STATUSES = ["DRAFT", "PUBLISHED", "RETIRED"];

function parseDate(v: unknown): Date | null {
  if (v === undefined) return undefined as unknown as Date | null;
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// Staff with CONTENT_ADMIN: edit / publish / schedule / retire a post.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;
  const { id } = await params;

  const existing = await db.post.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    data.title = body.title.trim().slice(0, 200);
  }
  if (typeof body.body === "string") data.body = body.body.slice(0, 8000);
  if (POST_TYPES.includes(body.type)) data.type = body.type;
  if (STATUSES.includes(body.status)) data.status = body.status;
  if ("imageUrl" in body) data.imageUrl = body.imageUrl ? String(body.imageUrl).slice(0, 1000) : null;
  if ("linkUrl" in body) data.linkUrl = body.linkUrl ? String(body.linkUrl).slice(0, 1000) : null;
  if ("linkLabel" in body) data.linkLabel = body.linkLabel ? String(body.linkLabel).slice(0, 100) : null;
  if ("rsvpEnabled" in body) data.rsvpEnabled = !!body.rsvpEnabled;
  if ("publishAt" in body) data.publishAt = parseDate(body.publishAt);
  if ("expiresAt" in body) data.expiresAt = parseDate(body.expiresAt);

  if ("audienceScope" in body) {
    const audienceErr = validateAudience({ scope: body.audienceScope, role: body.audienceRole, tag: body.audienceTag });
    if (audienceErr) return NextResponse.json({ error: audienceErr }, { status: 400 });
    data.audienceScope = body.audienceScope as AudienceScope;
    data.audienceRole = body.audienceScope === "INTERNAL_ROLE" ? String(body.audienceRole) : null;
    data.audienceTag = body.audienceScope === "TAG" ? String(body.audienceTag) : null;
  }

  const post = await db.post.update({ where: { id }, data });
  return NextResponse.json({ post });
}

// Staff with CONTENT_ADMIN: delete a post outright.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;
  const { id } = await params;

  const existing = await db.post.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await db.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
