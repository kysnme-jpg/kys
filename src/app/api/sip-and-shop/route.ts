import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendSipShopConfirmationEmail, sendSipShopStoreNotification } from "@/lib/email";
import { logEmail } from "@/lib/email-log";

const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

// Public: store info for the Sip & Shop request page.
export async function GET(_req: NextRequest) {
  const store = await db.store.findFirst({ select: { name: true, address: true } });
  if (!store) return NextResponse.json({ error: "Store not configured" }, { status: 503 });
  return NextResponse.json({ store: { name: store.name, address: store.address } });
}

const schema = z.object({
  hostName: z.string().min(1, "Please enter your name"),
  phone: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  email: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().email("Enter a valid email").optional()),
  guests: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0)),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  notes: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

// Public: a customer requests a Sip & Shop date.
export async function POST(req: NextRequest) {
  const store = await db.store.findFirst({ select: { id: true, name: true, address: true, email: true } });
  if (!store) return NextResponse.json({ error: "Store not configured" }, { status: 503 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const d = parsed.data;

  // Don't allow dates in the past.
  const when = parseKey(d.eventDate);
  const today = parseKey(new Date().toISOString().slice(0, 10));
  if (when < today) return NextResponse.json({ error: "Please choose a future date." }, { status: 400 });

  await db.sipShopEvent.create({
    data: { storeId: store.id, hostName: d.hostName.trim(), phone: d.phone, email: d.email, guests: d.guests, eventDate: when, notes: d.notes },
  });

  const dateLabel = fmt(when);

  // Confirmation to the customer.
  if (d.email) {
    try {
      await sendSipShopConfirmationEmail({ to: d.email, hostName: d.hostName.trim(), storeName: store.name, dateLabel, guests: d.guests, address: store.address });
      await logEmail({ storeId: store.id, to: d.email, type: "SIPSHOP", subject: `Sip & Shop — ${dateLabel}` });
    } catch { /* best-effort */ }
  }

  // Notify the store.
  const notifyTo = process.env.BOOKING_NOTIFY_EMAIL || store.email || "kimberly@classicconsigns.com";
  if (notifyTo) {
    try {
      await sendSipShopStoreNotification({ to: notifyTo, storeName: store.name, hostName: d.hostName.trim(), dateLabel, guests: d.guests, email: d.email, phone: d.phone });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ booked: true });
}
