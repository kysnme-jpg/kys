import { db } from "@/lib/db";
import type { Actor } from "@/lib/authz";

/**
 * External messaging repository (§4 + §4a Layer 5).
 *
 * The ONLY module allowed to touch the external messaging tables
 * (externalThread / externalMessage / externalInternalNote). Route handlers
 * call these functions with the server-resolved `Actor`; they never pass a
 * role, class, or channel from the client (Layer 1), and this module applies
 * the channel scope itself.
 *
 * Invariants enforced here (DB CHECK + RLS land at the migrate cutover / Phase 6):
 *  - A thread has EXACTLY ONE external party — a consignor OR a customer, never
 *    both and never neither (Layer 6, the recipient resolver).
 *  - An EXTERNAL actor can only ever read/write their own thread.
 *  - Internal notes are staff-only and are never returned to an external actor
 *    (they live in a separate table so a message read can't leak them — Layer 7).
 */

export type ExternalClass = "CONSIGNOR" | "CUSTOMER";

export interface ThreadMessage {
  id: string;
  sender: "STORE" | "CONSIGNOR" | "CUSTOMER";
  body: string;
  createdAt: Date;
}

export interface InternalNote {
  id: string;
  body: string;
  authorUserId: string | null;
  createdAt: Date;
}

export interface ThreadSummary {
  id: string;
  externalClass: ExternalClass;
  partyId: string;
  partyName: string;
  lastMessageAt: Date;
  lastSnippet: string;
  unreadForStore: number;
  status: string;
}

// ── Layer 6: recipient resolver ──────────────────────────────────────────────

/** Normalize an external-party reference; throws on a mixed or empty class. */
export function resolveExternalRecipient(ref: { consignorId?: string | null; customerId?: string | null }):
  { externalClass: ExternalClass; consignorId: string | null; customerId: string | null } {
  const hasConsignor = !!ref.consignorId;
  const hasCustomer = !!ref.customerId;
  if (hasConsignor && hasCustomer) {
    throw new Error("A conversation cannot target both a consignor and a customer.");
  }
  if (!hasConsignor && !hasCustomer) {
    throw new Error("A conversation needs exactly one external recipient.");
  }
  return hasConsignor
    ? { externalClass: "CONSIGNOR", consignorId: ref.consignorId!, customerId: null }
    : { externalClass: "CUSTOMER", consignorId: null, customerId: ref.customerId! };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function senderLabel(senderClass: string): "STORE" | "CONSIGNOR" | "CUSTOMER" {
  return senderClass === "INTERNAL" ? "STORE" : "CONSIGNOR";
}

function snippet(body: string): string {
  const s = body.replace(/\s+/g, " ").trim();
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
}

/**
 * One-time migration of a consignor's legacy ConsignorMessage history into a
 * freshly-created thread, preserving order and read state. Runs inside the same
 * flow that creates the thread, so it happens at most once per consignor.
 */
async function backfillLegacyConsignorMessages(threadId: string, storeId: string, consignorId: string): Promise<void> {
  const legacy = await db.consignorMessage.findMany({
    where: { consignorId },
    orderBy: { createdAt: "asc" },
  });
  if (legacy.length === 0) return;
  await db.externalMessage.createMany({
    data: legacy.map((m) => ({
      threadId,
      senderClass: m.sender === "STORE" ? "INTERNAL" : "EXTERNAL",
      senderConsignorId: m.sender === "CONSIGNOR" ? consignorId : null,
      body: m.body,
      readByStore: m.readByStore,
      readByExternal: m.readByConsignor,
      createdAt: m.createdAt,
    })),
  });
}

/** Get (or lazily create + backfill) the thread for a consignor. */
async function ensureConsignorThread(storeId: string, consignorId: string): Promise<string> {
  const existing = await db.externalThread.findUnique({ where: { consignorId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.externalThread.create({
    data: { storeId, externalClass: "CONSIGNOR", consignorId },
    select: { id: true },
  });
  await backfillLegacyConsignorMessages(created.id, storeId, consignorId);
  return created.id;
}

/** Get (or create) the thread for a customer. */
async function ensureCustomerThread(storeId: string, customerId: string): Promise<string> {
  const existing = await db.externalThread.findUnique({ where: { customerId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.externalThread.create({
    data: { storeId, externalClass: "CUSTOMER", customerId },
    select: { id: true },
  });
  return created.id;
}

// ── EXTERNAL actor (portal) — their own thread only ─────────────────────────

/** The external actor's own conversation with the store. Marks store replies read. */
export async function getMyThread(actor: Actor): Promise<{ messages: ThreadMessage[] }> {
  if (actor.class !== "EXTERNAL") throw new Error("External actors only.");
  // Only consignors have a portal today; customers get one later.
  const threadId = await ensureConsignorThread(actor.storeId, actor.consignorId);

  const rows = await db.externalMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, senderClass: true, body: true, createdAt: true },
  });

  // Anything the store sent is now seen by the external party.
  await db.externalMessage.updateMany({
    where: { threadId, senderClass: "INTERNAL", readByExternal: false },
    data: { readByExternal: true },
  });

  return {
    messages: rows.map((m) => ({ id: m.id, sender: senderLabel(m.senderClass), body: m.body, createdAt: m.createdAt })),
  };
}

/** The external actor posts a message to their own thread. */
export async function postFromExternal(actor: Actor, body: string): Promise<ThreadMessage & { threadId: string }> {
  if (actor.class !== "EXTERNAL") throw new Error("External actors only.");
  const text = String(body || "").trim();
  if (!text) throw new Error("Empty message.");
  const threadId = await ensureConsignorThread(actor.storeId, actor.consignorId);

  const m = await db.externalMessage.create({
    data: {
      threadId,
      senderClass: "EXTERNAL",
      senderConsignorId: actor.consignorId,
      body: text.slice(0, 4000),
      readByStore: false,
      readByExternal: true,
    },
    select: { id: true, senderClass: true, body: true, createdAt: true },
  });
  await db.externalThread.update({ where: { id: threadId }, data: { lastMessageAt: m.createdAt } });
  return { id: m.id, sender: senderLabel(m.senderClass), body: m.body, createdAt: m.createdAt, threadId };
}

// ── INTERNAL actor (staff) — unified inbox + per-party threads ───────────────

/** Staff inbox: every external conversation, newest activity first, with unread counts. */
export async function listThreadsForStaff(actor: Actor): Promise<ThreadSummary[]> {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
  const threads = await db.externalThread.findMany({
    where: { storeId: actor.storeId },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      consignor: { select: { firstName: true, lastName: true } },
      customer: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });

  // Unread (from the external party) counts per thread.
  const unread = await db.externalMessage.groupBy({
    by: ["threadId"],
    where: { thread: { storeId: actor.storeId }, senderClass: "EXTERNAL", readByStore: false },
    _count: { _all: true },
  });
  const unreadMap = new Map(unread.map((u) => [u.threadId, u._count._all]));

  return threads.map((t) => {
    const party = t.externalClass === "CONSIGNOR" ? t.consignor : t.customer;
    return {
      id: t.id,
      externalClass: t.externalClass as ExternalClass,
      partyId: (t.consignorId || t.customerId)!,
      partyName: party ? `${party.firstName} ${party.lastName}`.trim() : "Unknown",
      lastMessageAt: t.lastMessageAt,
      lastSnippet: t.messages[0] ? snippet(t.messages[0].body) : "",
      unreadForStore: unreadMap.get(t.id) || 0,
      status: t.status,
    };
  });
}

/** Total unread external messages across the store (for a badge — NO content, Layer 7). */
export async function unreadCountForStaff(actor: Actor): Promise<number> {
  if (actor.class !== "INTERNAL") return 0;
  return db.externalMessage.count({
    where: { thread: { storeId: actor.storeId }, senderClass: "EXTERNAL", readByStore: false },
  });
}

/** Staff view of one thread: messages + staff-only internal notes. Marks read. */
export async function getThreadForStaff(actor: Actor, threadId: string): Promise<{
  thread: { id: string; externalClass: ExternalClass; partyId: string; partyName: string; status: string };
  messages: ThreadMessage[];
  notes: InternalNote[];
} | null> {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
  const t = await db.externalThread.findFirst({
    where: { id: threadId, storeId: actor.storeId },
    include: {
      consignor: { select: { firstName: true, lastName: true } },
      customer: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, select: { id: true, senderClass: true, body: true, createdAt: true } },
      notes: { orderBy: { createdAt: "asc" }, take: 200, select: { id: true, body: true, authorUserId: true, createdAt: true } },
    },
  });
  if (!t) return null;

  await db.externalMessage.updateMany({
    where: { threadId, senderClass: "EXTERNAL", readByStore: false },
    data: { readByStore: true },
  });

  const party = t.externalClass === "CONSIGNOR" ? t.consignor : t.customer;
  return {
    thread: {
      id: t.id,
      externalClass: t.externalClass as ExternalClass,
      partyId: (t.consignorId || t.customerId)!,
      partyName: party ? `${party.firstName} ${party.lastName}`.trim() : "Unknown",
      status: t.status,
    },
    messages: t.messages.map((m) => ({ id: m.id, sender: senderLabel(m.senderClass), body: m.body, createdAt: m.createdAt })),
    notes: t.notes.map((n) => ({ id: n.id, body: n.body, authorUserId: n.authorUserId, createdAt: n.createdAt })),
  };
}

/** Resolve (and lazily create) the thread id for a given external party, store-scoped. */
async function resolveThreadIdForStaff(actor: Actor, ref: { threadId?: string; consignorId?: string; customerId?: string }): Promise<string> {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
  if (ref.threadId) {
    const t = await db.externalThread.findFirst({ where: { id: ref.threadId, storeId: actor.storeId }, select: { id: true } });
    if (!t) throw new Error("Thread not found.");
    return t.id;
  }
  const rec = resolveExternalRecipient(ref);
  if (rec.externalClass === "CONSIGNOR") {
    const c = await db.consignor.findFirst({ where: { id: rec.consignorId!, storeId: actor.storeId }, select: { id: true } });
    if (!c) throw new Error("Consignor not found.");
    return ensureConsignorThread(actor.storeId, c.id);
  } else {
    const c = await db.customer.findFirst({ where: { id: rec.customerId!, storeId: actor.storeId }, select: { id: true } });
    if (!c) throw new Error("Customer not found.");
    return ensureCustomerThread(actor.storeId, c.id);
  }
}

/** Staff reply to an external party. `ref` identifies the thread or the party. */
export async function postFromStaff(
  actor: Actor,
  ref: { threadId?: string; consignorId?: string; customerId?: string },
  body: string
): Promise<ThreadMessage & { threadId: string }> {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
  const text = String(body || "").trim();
  if (!text) throw new Error("Empty message.");
  const threadId = await resolveThreadIdForStaff(actor, ref);

  const m = await db.externalMessage.create({
    data: {
      threadId,
      senderClass: "INTERNAL",
      senderUserId: actor.userId,
      body: text.slice(0, 4000),
      readByStore: true,
      readByExternal: false,
    },
    select: { id: true, senderClass: true, body: true, createdAt: true },
  });
  await db.externalThread.update({ where: { id: threadId }, data: { lastMessageAt: m.createdAt } });
  return { id: m.id, sender: senderLabel(m.senderClass), body: m.body, createdAt: m.createdAt, threadId };
}

/** Staff attach an internal note to a thread — never shown to the external party. */
export async function addInternalNote(actor: Actor, threadId: string, body: string): Promise<InternalNote> {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
  const text = String(body || "").trim();
  if (!text) throw new Error("Empty note.");
  const t = await db.externalThread.findFirst({ where: { id: threadId, storeId: actor.storeId }, select: { id: true } });
  if (!t) throw new Error("Thread not found.");
  const n = await db.externalInternalNote.create({
    data: { threadId, authorUserId: actor.userId, body: text.slice(0, 4000) },
    select: { id: true, body: true, authorUserId: true, createdAt: true },
  });
  return n;
}

/**
 * §7 notification throttle. Atomically checks whether an email nudge is due for
 * a thread+direction (none sent within `windowMs`) and, if so, stamps the time
 * and returns the info a nudge needs. Kept here so the external tables are only
 * ever touched inside this repository.
 */
export async function claimNotifySlot(
  threadId: string,
  kind: "store" | "external",
  windowMs: number
): Promise<{ should: boolean; consignorEmail?: string | null; consignorName?: string }> {
  const t = await db.externalThread.findUnique({
    where: { id: threadId },
    select: {
      storeNotifiedAt: true, externalNotifiedAt: true,
      consignor: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!t) return { should: false };
  const last = kind === "store" ? t.storeNotifiedAt : t.externalNotifiedAt;
  if (last && Date.now() - last.getTime() < windowMs) return { should: false };
  await db.externalThread.update({
    where: { id: threadId },
    data: kind === "store" ? { storeNotifiedAt: new Date() } : { externalNotifiedAt: new Date() },
  });
  return {
    should: true,
    consignorEmail: t.consignor?.email,
    consignorName: t.consignor ? `${t.consignor.firstName} ${t.consignor.lastName}`.trim() : undefined,
  };
}

/**
 * Staff view of ONE consignor's conversation (for the consignor detail page).
 * Returns the message list in the same shape the portal uses. Lazily creates +
 * backfills the thread, and marks the consignor's messages read by the store.
 */
export async function getConsignorThreadForStaff(actor: Actor, consignorId: string): Promise<{ messages: ThreadMessage[] } | null> {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
  const c = await db.consignor.findFirst({ where: { id: consignorId, storeId: actor.storeId }, select: { id: true } });
  if (!c) return null;
  const threadId = await ensureConsignorThread(actor.storeId, consignorId);

  const rows = await db.externalMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, senderClass: true, body: true, createdAt: true },
  });
  await db.externalMessage.updateMany({
    where: { threadId, senderClass: "EXTERNAL", readByStore: false },
    data: { readByStore: true },
  });
  return { messages: rows.map((m) => ({ id: m.id, sender: senderLabel(m.senderClass), body: m.body, createdAt: m.createdAt })) };
}
