import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PERMISSIONS, ROLE_PERMISSIONS, DB_ROLE_TO_INTERNAL,
  type Permission, type InternalRole, type ExternalRole, type Role,
} from "@/lib/authz.permissions";

export { PERMISSIONS };
export type { Permission, InternalRole, ExternalRole, Role };

/**
 * Central authorization layer (Phase 0).
 *
 * Every protected route resolves the actor HERE, from the server session and a
 * fresh database lookup — never from a request body, query string, header, or
 * client-held claim. This is §4a Layer 1 (server-resolved identity) and the §1
 * "one authorization helper every route uses".
 *
 * Phase 1 will move the role→permission map into database tables; the helper
 * signatures below stay the same so callers don't change.
 */

export type AccountClass = "INTERNAL" | "EXTERNAL";

// ── Resolved actor ───────────────────────────────────────────────────────────

export type Actor =
  | { class: "INTERNAL"; role: InternalRole; userId: string; storeId: string; displayName: string; permissions: Set<Permission> }
  | { class: "EXTERNAL"; role: ExternalRole; consignorId: string; storeId: string; displayName: string; permissions: Set<Permission> };

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || process.env.NEXTAUTH_SECRET || "portal-secret-change-me"
);

// Resolve the INTERNAL (staff) actor from the NextAuth session + a fresh DB read.
async function resolveInternal(): Promise<Actor | null> {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return null;
  // Fresh lookup — role/storeId come from the DB now, not stale token claims.
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, storeId: true, name: true, email: true } });
  if (!user || !user.storeId) return null;
  const role = DB_ROLE_TO_INTERNAL[String(user.role)] || "associate";
  return {
    class: "INTERNAL",
    role,
    userId: user.id,
    storeId: user.storeId,
    displayName: user.name || user.email || "Staff",
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

// Resolve the EXTERNAL (consignor portal) actor from the portal JWT + fresh DB read.
async function resolveExternal(req: NextRequest): Promise<Actor | null> {
  const token = req.cookies.get("portal_token")?.value
    || (req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : undefined);
  if (!token) return null;
  let consignorId: string;
  try {
    const { payload } = await jwtVerify(token, PORTAL_SECRET);
    if (payload.type !== "consignor-portal" || !payload.sub) return null;
    consignorId = payload.sub as string;
  } catch {
    return null;
  }
  const c = await db.consignor.findFirst({ where: { id: consignorId, portalEnabled: true }, select: { id: true, storeId: true, firstName: true, lastName: true } });
  if (!c) return null;
  return {
    class: "EXTERNAL",
    role: "consignor",
    consignorId: c.id,
    storeId: c.storeId,
    displayName: `${c.firstName} ${c.lastName}`.trim(),
    permissions: new Set(ROLE_PERMISSIONS.consignor),
  };
}

/** Resolve whoever is making the request (internal first, then external). */
export async function resolveActor(req: NextRequest): Promise<Actor | null> {
  return (await resolveInternal()) ?? (await resolveExternal(req));
}

export function authorize(actor: Actor | null, permission: Permission): boolean {
  return !!actor && actor.permissions.has(permission);
}

// ── Route guards (return the actor, or a 403/401 Response to return directly) ──

export type GuardResult<T> = { ok: true; actor: T } | { ok: false; res: NextResponse };

const deny = (status: number, error: string): { ok: false; res: NextResponse } => ({ ok: false, res: NextResponse.json({ error }, { status }) });

export async function requireInternal(req: NextRequest): Promise<GuardResult<Extract<Actor, { class: "INTERNAL" }>>> {
  const actor = await resolveActor(req);
  if (!actor) return deny(401, "Not signed in.");
  if (actor.class !== "INTERNAL") return deny(403, "Staff access only.");
  return { ok: true, actor };
}

export async function requireExternal(req: NextRequest): Promise<GuardResult<Extract<Actor, { class: "EXTERNAL" }>>> {
  const actor = await resolveActor(req);
  if (!actor) return deny(401, "Not signed in.");
  if (actor.class !== "EXTERNAL") return deny(403, "Portal access only.");
  return { ok: true, actor };
}

export async function requireOwner(req: NextRequest): Promise<GuardResult<Extract<Actor, { class: "INTERNAL" }>>> {
  const g = await requireInternal(req);
  if (!g.ok) return g;
  if (g.actor.role !== "owner") return deny(403, "Owner access only.");
  return g;
}

export async function requirePermission(req: NextRequest, permission: Permission): Promise<GuardResult<Actor>> {
  const actor = await resolveActor(req);
  if (!actor) return deny(401, "Not signed in.");
  if (!authorize(actor, permission)) return deny(403, "You don't have permission for this.");
  return { ok: true, actor };
}
