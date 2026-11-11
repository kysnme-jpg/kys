import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInternal } from "@/lib/authz";
import { getNotificationSettings } from "@/lib/notifications";

export const runtime = "nodejs";

// Notification toggles. Owner/manager only (store-level configuration).
export async function GET(req: NextRequest) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  if (g.actor.role !== "owner" && g.actor.role !== "manager") return NextResponse.json({ error: "Owner or manager only." }, { status: 403 });
  const settings = await getNotificationSettings(g.actor.storeId);
  const store = await db.store.findUnique({ where: { id: g.actor.storeId }, select: { email: true } });
  return NextResponse.json({ settings, storeEmail: store?.email || null });
}

export async function PUT(req: NextRequest) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  if (g.actor.role !== "owner" && g.actor.role !== "manager") return NextResponse.json({ error: "Owner or manager only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data = {
    notifyStoreOnInboundMessage: !!body.notifyStoreOnInboundMessage,
    notifyConsignorOnStoreReply: !!body.notifyConsignorOnStoreReply,
    notifyAudienceOnNewPost: !!body.notifyAudienceOnNewPost,
    notifyEmail: body.notifyEmail ? String(body.notifyEmail).trim().slice(0, 200) : null,
  };
  await db.notificationSetting.upsert({
    where: { storeId: g.actor.storeId },
    create: { storeId: g.actor.storeId, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, settings: data });
}
