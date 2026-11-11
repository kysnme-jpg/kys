import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { requireInternal } from "@/lib/authz";

export const runtime = "nodejs";

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || process.env.NEXTAUTH_SECRET || "portal-secret-change-me"
);

/**
 * Issue a short-lived, READ-ONLY preview token so staff can see a consignor's
 * portal exactly as they do — without knowing or resetting their password.
 * Owner/manager only. The token carries `preview: true`; every portal write
 * route rejects it, so a preview can't act as the consignor.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  if (g.actor.role !== "owner" && g.actor.role !== "manager") {
    return NextResponse.json({ error: "Owner or manager only." }, { status: 403 });
  }
  const { id } = await params;

  const c = await db.consignor.findFirst({ where: { id, storeId: g.actor.storeId }, select: { id: true, storeId: true } });
  if (!c) return NextResponse.json({ error: "Consignor not found." }, { status: 404 });

  const token = await new SignJWT({ sub: c.id, storeId: c.storeId, type: "consignor-portal", preview: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(PORTAL_SECRET);

  return NextResponse.json({ token });
}
