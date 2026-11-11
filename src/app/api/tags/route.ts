import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInternal, requirePermission, PERMISSIONS } from "@/lib/authz";

export const runtime = "nodejs";

// List tags with how many people carry each (any staff — needed to apply tags).
export async function GET(req: NextRequest) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  const tags = await db.tag.findMany({
    where: { storeId: g.actor.storeId },
    orderBy: { name: "asc" },
    include: { _count: { select: { assignments: true } } },
  });
  return NextResponse.json({
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.assignments })),
  });
}

// Create a tag (content_admin — owners & managers manage the tag list).
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "A tag name is required." }, { status: 400 });
  const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : "#b4532a";
  try {
    const tag = await db.tag.create({ data: { storeId: g.actor.storeId, name: name.slice(0, 40), color } });
    return NextResponse.json({ tag: { id: tag.id, name: tag.name, color: tag.color, count: 0 } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A tag with that name already exists." }, { status: 409 });
  }
}
