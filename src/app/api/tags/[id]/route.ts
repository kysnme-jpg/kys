import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/authz";

export const runtime = "nodejs";

// Rename / recolor a tag (content_admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;
  const { id } = await params;
  const existing = await db.tag.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Tag not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 40);
  if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) data.color = body.color;
  try {
    const tag = await db.tag.update({ where: { id }, data });
    return NextResponse.json({ tag: { id: tag.id, name: tag.name, color: tag.color } });
  } catch {
    return NextResponse.json({ error: "A tag with that name already exists." }, { status: 409 });
  }
}

// Delete a tag — removes the label from everyone, never deletes people (content_admin).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;
  const { id } = await params;
  const existing = await db.tag.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  await db.tag.delete({ where: { id } }); // assignments cascade
  return NextResponse.json({ ok: true });
}
