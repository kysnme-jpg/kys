import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PERMISSIONS, ROLE_PERMISSIONS, DB_ROLE_TO_INTERNAL,
  type Permission, type InternalRole, type ExternalRole, type Role,
} from "@/lib/authz.permissions";
import { getPermissionsForRole } from "@/lib/rbac";

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
  | { class: "EXTERNAL"; role: ExternalRole; consignorId: string; storeId: string; displayName: string; permissions: Set<Permission>; preview?: boolean };

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || process.env.NEXTAUTH_SECRET || "portal-secret-change-me"
);

// Resolve the INTERNAL (staff) actor from the NextAuth session + a fresh DB read.
async function resolveInternal(): Promise<Actor | null> {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return null;
  // Fresh lookup — role/storeId come from the DB now, not stale token claims.
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, storeId: true, name: true, email: true, active: true } });
  if (!user || !user.storeId || user.active === false) return null;
  const role = DB_ROLE_TO_INTERNAL[String(user.role)] || "associate";
  // Permissions come from the database RBAC table (editable), falling back to
  // the static defaults when unseeded/unavailable.
  const permissions = await getPermissionsForRole(user.storeId, role);
  return {
    class: "INTERNAL",
    role,
    userId: user.id,
    storeId: user.storeId,
    displayName: user.name || user.email || "Staff",
    permissions,
  };
}

// Resolve the EXTERNAL (consignor portal) actor from the portal JWT + fresh DB read.
async function resolveExternal(req: NextRequest): Promise<Extract<Actor, { class: "EXTERNAL" }> | null> {
  const token = req.cookies.get("portal_token")?.value
    || (req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : undefined);
  if (!token) return null;
  let consignorId: string;
  let preview = false;
  try {
    const { payload } = await jwtVerify(token, PORTAL_SECRET);
    if (payload.type !== "consignor-portal" || !payload.sub) return null;
    consignorId = payload.sub as string;
    preview = payload.preview === true;
  } catch {
    return null;
  }
  // A real portal session requires portalEnabled; a staff preview token does not.
  const c = await db.consignor.findFirst({
    where: { id: consignorId, ...(preview ? {} : { portalEnabled: true }) },
    select: { id: true, storeId: true, firstName: true, lastName: true },
  });
  if (!c) return null;
  return {
    class: "EXTERNAL",
    role: "consignor",
    consignorId: c.id,
    storeId: c.storeId,
    displayName: `${c.firstName} ${c.lastName}`.trim(),
    permissions: new Set(ROLE_PERMISSIONS.consignor),
    preview,
  };
}

/** Resolve whoever is making the request (internal first, then external). */
export async function resolveActor(req: NextRequest): Promise<Actor | null> {
  return (await resolveInternal()) ?? (await resolveExternal(req));
}

/**
 * Like resolveActor, but when the request carries a portal Bearer token it
 * resolves that FIRST — so shared endpoints (content feed, RSVP) called from the
 * consignor portal aren't mistaken for staff when the same browser also has a
 * staff session. Staff requests (cookie-based, no Bearer) are unaffected.
 */
export async function resolveActorPreferPortal(req: NextRequest): Promise<Actor | null> {
  const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ");
  if (hasBearer) {
    const ext = await resolveExternal(req);
    if (ext) return ext;
  }
  return resolveActor(req);
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

/**
 * Portal-only guard. Resolves the consignor from the PORTAL token alone,
 * ignoring any staff session in the same browser. Use this for the portal's own
 * endpoints so an owner (or a staffer who is also a consignor) testing the
 * portal in a browser where they're also signed in as staff isn't mistaken for
 * internal and rejected.
 */
export async function requirePortal(req: NextRequest): Promise<GuardResult<Extract<Actor, { class: "EXTERNAL" }>>> {
  const actor = await resolveExternal(req);
  if (!actor) return deny(401, "Not signed in to the portal.");
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
