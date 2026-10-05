import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const s = store as any;
  // Never return the raw Clover API key — only whether one is set.
  return NextResponse.json({
    name: store.name,
    email: store.email,
    phone: store.phone,
    taxRate: store.taxRate,
    currency: store.currency,
    cloverMerchantId: s.cloverMerchantId,
    cloverApiKeySet: !!s.cloverApiKey,
  });
}

const schema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  currency: z.string().optional(),
  cloverMerchantId: z.string().nullable().optional(),
  cloverApiKey: z.string().optional(), // only applied when non-empty
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Only owners and managers can change store settings" }, { status: 403 });
  }

  const storeId = (session.user as any).storeId;
  const body = await req.json();
  const data = schema.parse(body);

  const update: Record<string, any> = {};
  for (const k of ["name", "email", "phone", "taxRate", "currency", "cloverMerchantId"] as const) {
    if (data[k] !== undefined) update[k] = data[k];
  }
  // Only overwrite the API key when a new non-empty value is supplied.
  if (data.cloverApiKey && data.cloverApiKey.trim()) {
    update.cloverApiKey = data.cloverApiKey.trim();
  }

  await db.store.update({ where: { id: storeId }, data: update });
  return NextResponse.json({ saved: true });
}
