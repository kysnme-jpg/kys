import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/authz";

export const runtime = "nodejs";

// UI role labels ↔ UserRole enum. "Employee" is the base staff role (stored as
// ASSOCIATE; the legacy EMPLOYEE value also displays as "Employee").
export const UI_ROLE_TO_ENUM: Record<string, string> = {
  owner: "OWNER", manager: "MANAGER", employee: "ASSOCIATE", inventory_clerk: "INVENTORY_CLERK",
};
export function enumToUiRole(role: string): string {
  if (role === "OWNER") return "owner";
  if (role === "MANAGER") return "manager";
  if (role === "INVENTORY_CLERK") return "inventory_clerk";
  return "employee"; // EMPLOYEE / ASSOCIATE
}

function tempPassword(): string {
  const words = ["sunny", "maple", "coral", "linen", "amber", "ivory", "cedar", "pearl"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

// List staff accounts (owner only).
export async function GET(req: NextRequest) {
  const g = await requireOwner(req);
  if (!g.ok) return g.res;
  const users = await db.user.findMany({
    where: { storeId: g.actor.storeId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, role: true, active: true, lastLoginAt: true },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      role: enumToUiRole(String(u.role)), active: u.active, lastLoginAt: u.lastLoginAt,
      isSelf: u.id === g.actor.userId,
    })),
  });
}

// Create a staff account (owner only). Returns a one-time temp password to share.
export async function POST(req: NextRequest) {
  const g = await requireOwner(req);
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = body.phone ? String(body.phone).trim() : null;
  const uiRole = String(body.role || "employee");
  const roleEnum = UI_ROLE_TO_ENUM[uiRole] || "ASSOCIATE";

  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  const dup = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (dup) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

  const temp = tempPassword();
  const passwordHash = await bcrypt.hash(temp, 12);
  const user = await db.user.create({
    data: { name, email, phone, role: roleEnum as any, storeId: g.actor.storeId, passwordHash, active: true },
    select: { id: true, name: true, email: true, phone: true, role: true, active: true },
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: enumToUiRole(String(user.role)), active: user.active, lastLoginAt: null, isSelf: false },
    tempPassword: temp,
  }, { status: 201 });
}
