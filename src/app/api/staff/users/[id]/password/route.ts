import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/authz";

export const runtime = "nodejs";

function tempPassword(): string {
  const words = ["sunny", "maple", "coral", "linen", "amber", "ivory", "cedar", "pearl"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

// Reset a staff member's password to a new temporary one (owner only).
// Returns the plaintext once so the owner can share it; the hash is never exposed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOwner(req);
  if (!g.ok) return g.res;
  const { id } = await params;

  const user = await db.user.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true, email: true } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const custom = typeof body.password === "string" ? body.password : "";
  const temp = custom && custom.length >= 8 ? custom : tempPassword();

  const passwordHash = await bcrypt.hash(temp, 12);
  await db.user.update({ where: { id }, data: { passwordHash } });

  return NextResponse.json({ ok: true, email: user.email, tempPassword: temp });
}
