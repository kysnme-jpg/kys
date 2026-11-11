import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/authz";
import { UI_ROLE_TO_ENUM, enumToUiRole } from "../route";

export const runtime = "nodejs";

async function activeOwnerCount(storeId: string): Promise<number> {
  return db.user.count({ where: { storeId, active: true, role: "OWNER" } });
}

// Update a staff account: role, active, name, phone (owner only).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOwner(req);
  if (!g.ok) return g.res;
  const { id } = await params;

  const user = await db.user.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true, role: true, active: true } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("phone" in body) data.phone = body.phone ? String(body.phone).trim() : null;

  // Role change — guard the last active owner.
  if (typeof body.role === "string" && UI_ROLE_TO_ENUM[body.role]) {
    const nextRole = UI_ROLE_TO_ENUM[body.role];
    if (String(user.role) === "OWNER" && nextRole !== "OWNER" && (await activeOwnerCount(g.actor.storeId)) <= 1) {
      return NextResponse.json({ error: "You can't remove the last owner. Make someone else an owner first." }, { status: 400 });
    }
    data.role = nextRole;
  }

  // Activate / deactivate — can't deactivate yourself or the last owner.
  if ("active" in body) {
    const nextActive = !!body.active;
    if (!nextActive) {
      if (id === g.actor.userId) return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
      if (String(user.role) === "OWNER" && (await activeOwnerCount(g.actor.storeId)) <= 1) {
        return NextResponse.json({ error: "You can't deactivate the last owner." }, { status: 400 });
      }
    }
    data.active = nextActive;
  }

  const updated = await db.user.update({
    where: { id }, data,
    select: { id: true, name: true, email: true, phone: true, role: true, active: true, lastLoginAt: true },
  });
  return NextResponse.json({
    user: { ...updated, role: enumToUiRole(String(updated.role)), isSelf: id === g.actor.userId },
  });
}

// Deactivate (soft-delete) a staff account (owner only).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOwner(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (id === g.actor.userId) return NextResponse.json({ error: "You can't remove your own account." }, { status: 400 });

  const user = await db.user.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true, role: true } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (String(user.role) === "OWNER" && (await activeOwnerCount(g.actor.storeId)) <= 1) {
    return NextResponse.json({ error: "You can't remove the last owner." }, { status: 400 });
  }
  await db.user.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
