import { db } from "@/lib/db";
import { DB_ROLE_TO_INTERNAL } from "@/lib/authz.permissions";
import type { AudienceTarget } from "@/lib/posts";
import { peopleWithTag } from "@/lib/tags";

/**
 * Resolve an audience (§2 targeting) to a de-duplicated list of email
 * recipients, store-scoped. Shared by the audience email composer (§5) so a
 * "promotion to all consignors" means exactly the same set as the matching
 * content-feed post.
 *
 * Server-only (reads the database). TAG targeting yields no one until tags
 * land (§5 spec section pending).
 */

export interface Recipient { email: string; name: string; }

export async function resolveAudienceRecipients(storeId: string, target: AudienceTarget): Promise<Recipient[]> {
  const out = new Map<string, Recipient>();
  const add = (email?: string | null, name?: string) => {
    if (!email) return;
    const trimmed = email.trim();
    const key = trimmed.toLowerCase();
    if (!key || !key.includes("@") || out.has(key)) return;
    out.set(key, { email: trimmed, name: name || "" });
  };

  const scope = target.scope;
  const wantStaff = scope === "EVERYONE" || scope === "ALL_INTERNAL" || scope === "INTERNAL_ROLE";
  const wantConsignors = scope === "EVERYONE" || scope === "ALL_CONSIGNORS";
  const wantCustomers = scope === "EVERYONE" || scope === "ALL_CUSTOMERS";

  if (wantStaff) {
    const users = await db.user.findMany({ where: { storeId, active: true }, select: { email: true, name: true, role: true } });
    for (const u of users) {
      if (scope === "INTERNAL_ROLE") {
        const role = DB_ROLE_TO_INTERNAL[String(u.role)] || "associate";
        if (role !== target.role) continue;
      }
      add(u.email, u.name || undefined);
    }
  }
  if (wantConsignors) {
    const cs = await db.consignor.findMany({ where: { storeId }, select: { email: true, firstName: true, lastName: true } });
    for (const c of cs) add(c.email, `${c.firstName} ${c.lastName}`.trim());
  }
  if (wantCustomers) {
    const cs = await db.customer.findMany({ where: { storeId }, select: { email: true, firstName: true, lastName: true } });
    for (const c of cs) add(c.email, `${c.firstName} ${c.lastName}`.trim());
  }

  if (scope === "TAG" && target.tag) {
    const { consignorIds, customerIds } = await peopleWithTag(storeId, target.tag);
    if (consignorIds.length) {
      const cs = await db.consignor.findMany({ where: { id: { in: consignorIds }, storeId }, select: { email: true, firstName: true, lastName: true } });
      for (const c of cs) add(c.email, `${c.firstName} ${c.lastName}`.trim());
    }
    if (customerIds.length) {
      const cs = await db.customer.findMany({ where: { id: { in: customerIds }, storeId }, select: { email: true, firstName: true, lastName: true } });
      for (const c of cs) add(c.email, `${c.firstName} ${c.lastName}`.trim());
    }
  }

  return Array.from(out.values());
}
