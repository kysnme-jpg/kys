import { db } from "@/lib/db";
import type { Actor } from "@/lib/authz";

/**
 * Internal messaging repository (§3 + §4a Layer 5).
 *
 * The ONLY module allowed to touch the internal messaging tables
 * (internalChannel / internalThread / internalParticipant / internalMessage).
 * Staff ↔ staff only — every reference is a staff `userId`; a consignor or
 * customer id can never enter these tables, which is the isolation boundary
 * from the internal side. Route handlers call these with the server-resolved
 * INTERNAL `Actor` (Layer 1) and never pass identity from the client.
 */

const GENERAL = "General";

export interface MsgRow { id: string; senderUserId: string; senderName: string; mine: boolean; body: string; createdAt: Date; }
export interface ChannelSummary { id: string; name: string; description: string | null; lastMessageAt: Date; unread: number; }
export interface DirectSummary { id: string; title: string; otherNames: string[]; lastMessageAt: Date; unread: number; }
export interface StaffRef { id: string; name: string; role: string }

type InternalActor = Extract<Actor, { class: "INTERNAL" }>;

function assertInternal(actor: Actor): asserts actor is InternalActor {
  if (actor.class !== "INTERNAL") throw new Error("Staff only.");
}

// Resolve display names for a set of staff ids (no User relation on the message tables).
async function nameMap(userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, u.name || u.email || "Staff"]));
}

function toRows(rows: { id: string; senderUserId: string; body: string; createdAt: Date }[], names: Map<string, string>, meId: string): MsgRow[] {
  return rows.map((m) => ({
    id: m.id, senderUserId: m.senderUserId, senderName: names.get(m.senderUserId) || "Staff",
    mine: m.senderUserId === meId, body: m.body, createdAt: m.createdAt,
  }));
}

// ── Directory (who you can message) ──────────────────────────────────────────

export async function listDirectory(actor: Actor): Promise<StaffRef[]> {
  assertInternal(actor);
  const users = await db.user.findMany({
    where: { storeId: actor.storeId, active: true, id: { not: actor.userId } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.email || "Staff", role: String(u.role) }));
}

// ── Channels ─────────────────────────────────────────────────────────────────

/** Ensure a store has the default #General channel (created on first use). */
async function ensureGeneralChannel(storeId: string): Promise<void> {
  const count = await db.internalChannel.count({ where: { storeId } });
  if (count === 0) {
    await db.internalChannel.create({ data: { storeId, name: GENERAL, description: "Team-wide chat" } });
  }
}

async function unreadForChannel(channelId: string, userId: string, lastReadAt: Date | null): Promise<number> {
  return db.internalMessage.count({
    where: { channelId, senderUserId: { not: userId }, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) },
  });
}

export async function listChannels(actor: Actor): Promise<ChannelSummary[]> {
  assertInternal(actor);
  await ensureGeneralChannel(actor.storeId);
  const channels = await db.internalChannel.findMany({ where: { storeId: actor.storeId }, orderBy: { lastMessageAt: "desc" } });
  const parts = await db.internalParticipant.findMany({ where: { userId: actor.userId, channelId: { in: channels.map((c) => c.id) } }, select: { channelId: true, lastReadAt: true } });
  const readMap = new Map(parts.map((p) => [p.channelId!, p.lastReadAt]));
  const out: ChannelSummary[] = [];
  for (const c of channels) {
    out.push({
      id: c.id, name: c.name, description: c.description,
      lastMessageAt: c.lastMessageAt,
      unread: await unreadForChannel(c.id, actor.userId, readMap.get(c.id) ?? null),
    });
  }
  return out;
}

export async function createChannel(actor: Actor, name: string, description?: string): Promise<{ id: string }> {
  assertInternal(actor);
  const n = String(name || "").trim();
  if (!n) throw new Error("A channel name is required.");
  const c = await db.internalChannel.create({
    data: { storeId: actor.storeId, name: n.slice(0, 80), description: description ? String(description).slice(0, 200) : null, createdByUserId: actor.userId },
    select: { id: true },
  });
  return c;
}

export async function getChannel(actor: Actor, channelId: string): Promise<{ channel: { id: string; name: string; description: string | null }; messages: MsgRow[] } | null> {
  assertInternal(actor);
  const c = await db.internalChannel.findFirst({ where: { id: channelId, storeId: actor.storeId }, select: { id: true, name: true, description: true } });
  if (!c) return null;
  const rows = await db.internalMessage.findMany({ where: { channelId }, orderBy: { createdAt: "asc" }, take: 500, select: { id: true, senderUserId: true, body: true, createdAt: true } });
  const names = await nameMap(rows.map((r) => r.senderUserId));
  await markChannelRead(actor, channelId);
  return { channel: c, messages: toRows(rows, names, actor.userId) };
}

async function markChannelRead(actor: InternalActor, channelId: string): Promise<void> {
  await db.internalParticipant.upsert({
    where: { channelId_userId: { channelId, userId: actor.userId } },
    create: { channelId, userId: actor.userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

export async function postToChannel(actor: Actor, channelId: string, body: string): Promise<MsgRow> {
  assertInternal(actor);
  const text = String(body || "").trim();
  if (!text) throw new Error("Empty message.");
  const c = await db.internalChannel.findFirst({ where: { id: channelId, storeId: actor.storeId }, select: { id: true } });
  if (!c) throw new Error("Channel not found.");
  const m = await db.internalMessage.create({ data: { channelId, senderUserId: actor.userId, body: text.slice(0, 4000) }, select: { id: true, senderUserId: true, body: true, createdAt: true } });
  await db.internalChannel.update({ where: { id: channelId }, data: { lastMessageAt: m.createdAt } });
  await markChannelRead(actor, channelId);
  return { id: m.id, senderUserId: m.senderUserId, senderName: actor.displayName, mine: true, body: m.body, createdAt: m.createdAt };
}

// ── Direct threads ───────────────────────────────────────────────────────────

/** Validate target staff ids: all must be active users in the same store (Layer 6). */
async function validateStaffTargets(actor: InternalActor, userIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(userIds.filter(Boolean).filter((id) => id !== actor.userId)));
  if (ids.length === 0) throw new Error("Pick at least one teammate.");
  const users = await db.user.findMany({ where: { id: { in: ids }, storeId: actor.storeId, active: true }, select: { id: true } });
  if (users.length !== ids.length) throw new Error("One or more teammates are not valid staff in this store.");
  return ids;
}

export async function startDirectThread(actor: Actor, userIds: string[]): Promise<{ id: string }> {
  assertInternal(actor);
  const targets = await validateStaffTargets(actor, userIds);
  const members = Array.from(new Set([actor.userId, ...targets])).sort();

  // Dedupe: find an existing thread with exactly this member set.
  const mine = await db.internalThread.findMany({
    where: { storeId: actor.storeId, participants: { some: { userId: actor.userId } } },
    select: { id: true, participants: { select: { userId: true } } },
  });
  for (const t of mine) {
    const set = t.participants.map((p) => p.userId).sort();
    if (set.length === members.length && set.every((v, i) => v === members[i])) return { id: t.id };
  }

  const thread = await db.internalThread.create({
    data: {
      storeId: actor.storeId, createdByUserId: actor.userId,
      participants: { create: members.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
  return thread;
}

async function isParticipant(threadId: string, userId: string): Promise<boolean> {
  const p = await db.internalParticipant.findUnique({ where: { threadId_userId: { threadId, userId } }, select: { id: true } });
  return !!p;
}

async function unreadForThread(threadId: string, userId: string, lastReadAt: Date | null): Promise<number> {
  return db.internalMessage.count({ where: { threadId, senderUserId: { not: userId }, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) } });
}

export async function listDirectThreads(actor: Actor): Promise<DirectSummary[]> {
  assertInternal(actor);
  const threads = await db.internalThread.findMany({
    where: { storeId: actor.storeId, participants: { some: { userId: actor.userId } } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { participants: { select: { userId: true, lastReadAt: true } } },
  });
  const otherIds = threads.flatMap((t) => t.participants.map((p) => p.userId)).filter((id) => id !== actor.userId);
  const names = await nameMap(otherIds);
  const out: DirectSummary[] = [];
  for (const t of threads) {
    const me = t.participants.find((p) => p.userId === actor.userId);
    const others = t.participants.filter((p) => p.userId !== actor.userId).map((p) => names.get(p.userId) || "Staff");
    out.push({
      id: t.id,
      title: others.join(", ") || "Just you",
      otherNames: others,
      lastMessageAt: t.lastMessageAt,
      unread: await unreadForThread(t.id, actor.userId, me?.lastReadAt ?? null),
    });
  }
  return out;
}

async function markThreadRead(actor: InternalActor, threadId: string): Promise<void> {
  await db.internalParticipant.update({ where: { threadId_userId: { threadId, userId: actor.userId } }, data: { lastReadAt: new Date() } }).catch(() => {});
}

export async function getThread(actor: Actor, threadId: string): Promise<{ thread: { id: string; title: string }; messages: MsgRow[] } | null> {
  assertInternal(actor);
  if (!(await isParticipant(threadId, actor.userId))) return null;
  const t = await db.internalThread.findFirst({ where: { id: threadId, storeId: actor.storeId }, include: { participants: { select: { userId: true } } } });
  if (!t) return null;
  const rows = await db.internalMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" }, take: 500, select: { id: true, senderUserId: true, body: true, createdAt: true } });
  const names = await nameMap([...rows.map((r) => r.senderUserId), ...t.participants.map((p) => p.userId)]);
  await markThreadRead(actor, threadId);
  const others = t.participants.filter((p) => p.userId !== actor.userId).map((p) => names.get(p.userId) || "Staff");
  return { thread: { id: t.id, title: others.join(", ") || "Just you" }, messages: toRows(rows, names, actor.userId) };
}

export async function postToThread(actor: Actor, threadId: string, body: string): Promise<MsgRow> {
  assertInternal(actor);
  const text = String(body || "").trim();
  if (!text) throw new Error("Empty message.");
  if (!(await isParticipant(threadId, actor.userId))) throw new Error("You're not in this conversation.");
  const m = await db.internalMessage.create({ data: { threadId, senderUserId: actor.userId, body: text.slice(0, 4000) }, select: { id: true, senderUserId: true, body: true, createdAt: true } });
  await db.internalThread.update({ where: { id: threadId }, data: { lastMessageAt: m.createdAt } });
  await markThreadRead(actor, threadId);
  return { id: m.id, senderUserId: m.senderUserId, senderName: actor.displayName, mine: true, body: m.body, createdAt: m.createdAt };
}

// ── Unread badge (counts only — no content, Layer 7) ─────────────────────────

export async function unreadCountInternal(actor: Actor): Promise<number> {
  if (actor.class !== "INTERNAL") return 0;
  const channels = await listChannels(actor);
  const threads = await listDirectThreads(actor);
  return channels.reduce((n, c) => n + c.unread, 0) + threads.reduce((n, t) => n + t.unread, 0);
}
