import { db } from "@/lib/db";
import { claimNotifySlot } from "@/lib/messaging/external";
import { sendStoreMessageNudge, sendConsignorMessageNudge, sendBroadcast } from "@/lib/email";
import { resolveAudienceRecipients } from "@/lib/audience-recipients";
import type { AudienceScope } from "@/lib/posts";

/**
 * Notification orchestration (§7). Owner-controlled toggles decide which events
 * also send an email. Email nudges are content-free (§4a Layer 7). All sends are
 * best-effort and must never block or fail the originating request.
 */

const THROTTLE_MS = 5 * 60 * 1000; // at most one nudge per conversation per 5 min

export interface NotificationSettings {
  notifyStoreOnInboundMessage: boolean;
  notifyConsignorOnStoreReply: boolean;
  notifyAudienceOnNewPost: boolean;
  notifyEmail: string | null;
}

const DEFAULTS: NotificationSettings = {
  notifyStoreOnInboundMessage: true,
  notifyConsignorOnStoreReply: true,
  notifyAudienceOnNewPost: false,
  notifyEmail: null,
};

/** Load a store's notification settings, falling back to defaults when unset. */
export async function getNotificationSettings(storeId: string): Promise<NotificationSettings> {
  try {
    const row = await db.notificationSetting.findUnique({ where: { storeId } });
    if (!row) return { ...DEFAULTS };
    return {
      notifyStoreOnInboundMessage: row.notifyStoreOnInboundMessage,
      notifyConsignorOnStoreReply: row.notifyConsignorOnStoreReply,
      notifyAudienceOnNewPost: row.notifyAudienceOnNewPost,
      notifyEmail: row.notifyEmail,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** A consignor/customer messaged the store → nudge the store (throttled). */
export async function notifyInboundExternalMessage(storeId: string, threadId: string, fromName: string): Promise<void> {
  try {
    const settings = await getNotificationSettings(storeId);
    if (!settings.notifyStoreOnInboundMessage) return;
    const slot = await claimNotifySlot(threadId, "store", THROTTLE_MS);
    if (!slot.should) return;
    const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true, email: true } });
    const to = settings.notifyEmail || store?.email;
    if (!to) return;
    await sendStoreMessageNudge({ to, storeName: store?.name || "Your store", fromName });
  } catch {
    // never let a notification break the message send
  }
}

/** The store replied to a consignor → nudge the consignor (throttled). */
export async function notifyStoreReply(storeId: string, threadId: string): Promise<void> {
  try {
    const settings = await getNotificationSettings(storeId);
    if (!settings.notifyConsignorOnStoreReply) return;
    const slot = await claimNotifySlot(threadId, "external", THROTTLE_MS);
    if (!slot.should || !slot.consignorEmail) return;
    const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
    await sendConsignorMessageNudge({ to: slot.consignorEmail, storeName: store?.name || "Your store" });
  } catch {
    // swallow
  }
}

/**
 * A post was just published to an audience → optionally email that audience the
 * post (OFF by default; the Email Blast is the usual deliberate channel).
 */
export async function notifyNewPost(storeId: string, post: {
  title: string; body: string; audienceScope: string; audienceRole?: string | null; audienceTag?: string | null;
}): Promise<void> {
  try {
    const settings = await getNotificationSettings(storeId);
    if (!settings.notifyAudienceOnNewPost) return;
    const recipients = await resolveAudienceRecipients(storeId, {
      scope: post.audienceScope as AudienceScope, role: post.audienceRole, tag: post.audienceTag,
    });
    if (recipients.length === 0) return;
    const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
    await sendBroadcast({ recipients, subject: post.title, message: post.body, storeName: store?.name || "Your store" });
  } catch {
    // swallow
  }
}
