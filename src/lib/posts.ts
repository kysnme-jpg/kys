import type { Actor } from "@/lib/authz";

/**
 * Audience targeting (§2). A single model shared by the content feed and, later,
 * the audience email composer (Phase 5) — one place decides who a post or blast
 * is for, so the two can never drift apart.
 *
 * Isolation note (§4a): audience targeting decides VISIBILITY of broadcast
 * content (posts/email), which is deliberately one-to-many and cross-class.
 * It is NOT a messaging channel and never resolves a conversation recipient,
 * so it lives outside the strict internal/external messaging boundary.
 */

export type AudienceScope =
  | "EVERYONE"
  | "ALL_INTERNAL"
  | "INTERNAL_ROLE"
  | "ALL_CONSIGNORS"
  | "ALL_CUSTOMERS"
  | "TAG";

export const AUDIENCE_SCOPES: { value: AudienceScope; label: string; help: string }[] = [
  { value: "EVERYONE", label: "Everyone", help: "All staff and all members who can see the feed." },
  { value: "ALL_INTERNAL", label: "All staff", help: "Every internal team member (owner, managers, associates, clerks)." },
  { value: "INTERNAL_ROLE", label: "A specific staff role", help: "Only staff with the chosen role." },
  { value: "ALL_CONSIGNORS", label: "All consignors", help: "Every consignor with portal access." },
  { value: "ALL_CUSTOMERS", label: "All customers", help: "Every customer (once customer logins are enabled)." },
  { value: "TAG", label: "A tag / list", help: "Members with a given tag (tags arrive in a later phase)." },
];

export const INTERNAL_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "associate", label: "Associate" },
  { value: "inventory_clerk", label: "Inventory clerk" },
];

export const POST_TYPES: { value: string; label: string }[] = [
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "NEWS", label: "News" },
  { value: "EVENT", label: "Event" },
  { value: "PROMOTION", label: "Promotion" },
];

export interface AudienceTarget {
  scope: AudienceScope;
  role?: string | null;
  tag?: string | null;
}

/** Does this post's audience include the given actor? (Used for previews/tests.) */
export function audienceIncludesActor(target: AudienceTarget, actor: Actor): boolean {
  switch (target.scope) {
    case "EVERYONE":
      return true;
    case "ALL_INTERNAL":
      return actor.class === "INTERNAL";
    case "INTERNAL_ROLE":
      return actor.class === "INTERNAL" && actor.role === target.role;
    case "ALL_CONSIGNORS":
      return actor.class === "EXTERNAL" && actor.role === "consignor";
    case "ALL_CUSTOMERS":
      return actor.class === "EXTERNAL" && actor.role === "customer";
    case "TAG":
      // Tags not yet implemented (§5); no one matches until they are.
      return false;
    default:
      return false;
  }
}

/**
 * Build the Prisma `OR` of audience conditions that this actor can see.
 * Combine with the publish-window + status filter from `publishedWindowWhere`.
 */
export function audienceOrForActor(actor: Actor): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = [{ audienceScope: "EVERYONE" }];
  if (actor.class === "INTERNAL") {
    or.push({ audienceScope: "ALL_INTERNAL" });
    or.push({ audienceScope: "INTERNAL_ROLE", audienceRole: actor.role });
  } else if (actor.class === "EXTERNAL") {
    if (actor.role === "consignor") or.push({ audienceScope: "ALL_CONSIGNORS" });
    if (actor.role === "customer") or.push({ audienceScope: "ALL_CUSTOMERS" });
  }
  return or;
}

/** Status + publish-window filter: PUBLISHED, started, not expired. */
export function publishedWindowWhere(now: Date = new Date()): Record<string, unknown> {
  return {
    status: "PUBLISHED",
    AND: [
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
    ],
  };
}

/** Full feed `where` for an actor, scoped to their store. */
export function feedWhereForActor(actor: Actor, now: Date = new Date()): Record<string, unknown> {
  return {
    storeId: actor.storeId,
    ...publishedWindowWhere(now),
    OR: audienceOrForActor(actor),
  };
}

/** Human label for an audience target (for admin lists / previews). */
export function describeAudience(target: AudienceTarget): string {
  switch (target.scope) {
    case "EVERYONE":
      return "Everyone";
    case "ALL_INTERNAL":
      return "All staff";
    case "INTERNAL_ROLE":
      return `Staff: ${INTERNAL_ROLE_OPTIONS.find((r) => r.value === target.role)?.label || target.role || "?"}`;
    case "ALL_CONSIGNORS":
      return "All consignors";
    case "ALL_CUSTOMERS":
      return "All customers";
    case "TAG":
      return `Tag: ${target.tag || "?"}`;
    default:
      return String(target.scope);
  }
}

/** Validate an incoming audience target; returns an error string or null. */
export function validateAudience(target: Partial<AudienceTarget>): string | null {
  const scopes = AUDIENCE_SCOPES.map((s) => s.value);
  if (!target.scope || !scopes.includes(target.scope as AudienceScope)) return "Invalid audience.";
  if (target.scope === "INTERNAL_ROLE") {
    if (!target.role || !INTERNAL_ROLE_OPTIONS.some((r) => r.value === target.role)) return "Pick a staff role for this audience.";
  }
  if (target.scope === "TAG" && !target.tag) return "Pick a tag for this audience.";
  return null;
}
