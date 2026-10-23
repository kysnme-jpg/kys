import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendSipShopConfirmationEmail } from "@/lib/email";
import { logEmail } from "@/lib/email-log";
import { processDueReminders } from "@/lib/reminders";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const schema = z.object({
  hostName: z.string().min(1, "Host name is required"),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  email: z.preprocess(emptyToUndef, z.string().email("Enter a valid email").optional()),
  guests: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0)),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an event date"),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  try { await processDueReminders(storeId); } catch { /* ignore */ }

  const events = await db.sipShopEvent.findMany({ where: { storeId }, orderBy: { eventDate: "asc" } });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  const d = parsed.data;

  const event = await db.sipShopEvent.create({
    data: { storeId, hostName: d.hostName.trim(), phone: d.phone, email: d.email, guests: d.guests, eventDate: parseKey(d.eventDate), notes: d.notes },
  });

  const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true, address: true } });
  if (d.email) {
    try {
      await sendSipShopConfirmationEmail({
        to: d.email,
        hostName: d.hostName.trim(),
        storeName: store?.name || "Classic Consigns by KYS",
        dateLabel: fmt(parseKey(d.eventDate)),
        guests: d.guests,
        address: store?.address,
      });
      await logEmail({ storeId, to: d.email, type: "SIPSHOP", subject: `Sip & Shop — ${fmt(parseKey(d.eventDate))}` });
    } catch { /* best-effort */ }
  }

  return NextResponse.json(event, { status: 201 });
}
