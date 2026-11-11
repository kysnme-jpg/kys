import { db } from "@/lib/db";
import type { Actor } from "@/lib/authz";

/**
 * Tags / segments (§5). Labels applied to consignors and customers, used as an
 * audience in the content feed and email blasts.
 */

/** The tag names that apply to this actor (for feed audience resolution). */
export async function getActorTagNames(actor: Actor): Promise<string[]> {
  // Tags are for external people (consignors/customers). Staff never match a tag.
  if (actor.class !== "EXTERNAL") return [];
  const rows = await db.tagAssignment.findMany({
    where: { consignorId: actor.consignorId },
    select: { tag: { select: { name: true } } },
  });
  return rows.map((r) => r.tag.name);
}

/** The consignor + customer ids in a store that carry the given tag name. */
export async function peopleWithTag(storeId: string, tagName: string): Promise<{ consignorIds: string[]; customerIds: string[] }> {
  const tag = await db.tag.findUnique({ where: { storeId_name: { storeId, name: tagName } }, select: { id: true } });
  if (!tag) return { consignorIds: [], customerIds: [] };
  const rows = await db.tagAssignment.findMany({ where: { tagId: tag.id }, select: { consignorId: true, customerId: true } });
  return {
    consignorIds: rows.map((r) => r.consignorId).filter((v): v is string => !!v),
    customerIds: rows.map((r) => r.customerId).filter((v): v is string => !!v),
  };
}
