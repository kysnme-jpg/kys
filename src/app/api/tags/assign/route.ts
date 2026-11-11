import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInternal } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * Apply or remove a tag on one or more consignors/customers (any staff).
 * Body: { tagId, action: "add"|"remove", consignorIds?: string[], customerIds?: string[] }
 * (singular consignorId/customerId also accepted). The exactly-one-party rule is
 * enforced per assignment by the DB CHECK constraint.
 */
export async function POST(req: NextRequest) {
  const g = await requireInternal(req);
  if (!g.ok) return g.res;
  const storeId = g.actor.storeId;

  const body = await req.json().catch(() => ({}));
  const tagId = String(body.tagId || "");
  const action = body.action === "remove" ? "remove" : "add";
  const consignorIds: string[] = [...(Array.isArray(body.consignorIds) ? body.consignorIds : []), ...(body.consignorId ? [body.consignorId] : [])].map(String);
  const customerIds: string[] = [...(Array.isArray(body.customerIds) ? body.customerIds : []), ...(body.customerId ? [body.customerId] : [])].map(String);

  const tag = await db.tag.findFirst({ where: { id: tagId, storeId }, select: { id: true } });
  if (!tag) return NextResponse.json({ error: "Tag not found." }, { status: 404 });

  // Only operate on people that actually belong to this store.
  const validConsignors = consignorIds.length
    ? (await db.consignor.findMany({ where: { id: { in: consignorIds }, storeId }, select: { id: true } })).map((c) => c.id)
    : [];
  const validCustomers = customerIds.length
    ? (await db.customer.findMany({ where: { id: { in: customerIds }, storeId }, select: { id: true } })).map((c) => c.id)
    : [];

  if (action === "add") {
    if (validConsignors.length) {
      await db.tagAssignment.createMany({ data: validConsignors.map((consignorId) => ({ tagId, consignorId })), skipDuplicates: true });
    }
    if (validCustomers.length) {
      await db.tagAssignment.createMany({ data: validCustomers.map((customerId) => ({ tagId, customerId })), skipDuplicates: true });
    }
  } else {
    if (validConsignors.length) await db.tagAssignment.deleteMany({ where: { tagId, consignorId: { in: validConsignors } } });
    if (validCustomers.length) await db.tagAssignment.deleteMany({ where: { tagId, customerId: { in: validCustomers } } });
  }

  return NextResponse.json({ ok: true, action, consignors: validConsignors.length, customers: validCustomers.length });
}
