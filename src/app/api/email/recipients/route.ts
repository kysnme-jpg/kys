import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { resolveAudienceRecipients } from "@/lib/audience-recipients";
import { validateAudience, type AudienceScope } from "@/lib/posts";

export const runtime = "nodejs";

// How many people an audience reaches (live count for the composer). CONTENT_ADMIN.
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, PERMISSIONS.CONTENT_ADMIN);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const target = { scope: sp.get("scope") as AudienceScope, role: sp.get("role"), tag: sp.get("tag") };
  const err = validateAudience(target);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const recipients = await resolveAudienceRecipients(g.actor.storeId, target);
  return NextResponse.json({
    count: recipients.length,
    sample: recipients.slice(0, 5).map((r) => r.email),
  });
}
