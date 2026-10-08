import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { upcomingSaturdays, dateKey, slotLabel, prettyDate, SLOT_TIMES, MAX_APPTS_PER_DAY } from "@/lib/appointments";
import { sendAppointmentEmail } from "@/lib/email";

const BOOK_WEEKS = 10;
const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);

// Public: list upcoming Saturdays with availability.
export async function GET(_req: NextRequest) {
  const store = await db.store.findFirst({ select: { id: true, name: true, address: true } });
  if (!store) return NextResponse.json({ error: "Store not configured" }, { status: 503 });

  const keys = upcomingSaturdays(BOOK_WEEKS);
  const from = parseKey(keys[0]);

  const [appts, blocks] = await Promise.all([
    db.consignAppointment.findMany({ where: { storeId: store.id, date: { gte: from } }, select: { date: true, slot: true } }),
    db.consignBlockedDate.findMany({ where: { storeId: store.id, date: { gte: from } }, select: { date: true, reason: true } }),
  ]);

  const bookedByDay: Record<string, number[]> = {};
  for (const a of appts) {
    const k = dateKey(a.date);
    (bookedByDay[k] ||= []).push(a.slot);
  }
  const blockedByDay: Record<string, string | null> = {};
  for (const b of blocks) blockedByDay[dateKey(b.date)] = b.reason ?? "No appointments";

  const saturdays = keys.map((date) => ({
    date,
    blocked: date in blockedByDay,
    blockedReason: blockedByDay[date] ?? null,
    bookedSlots: bookedByDay[date] ?? [],
  }));

  return NextResponse.json({ store: { name: store.name, address: store.address }, slotCount: SLOT_TIMES.length, saturdays });
}

const bookSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.number().int().min(0).max(MAX_APPTS_PER_DAY - 1),
  name: z.string().min(1, "Please enter your name"),
  email: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().email("Enter a valid email").optional()),
  phone: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  note: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

// Public: book an appointment.
export async function POST(req: NextRequest) {
  const store = await db.store.findFirst({ select: { id: true, name: true, address: true } });
  if (!store) return NextResponse.json({ error: "Store not configured" }, { status: 503 });

  const parsed = bookSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const { date, slot, name, email, phone, note } = parsed.data;

  // Must be one of the upcoming Saturdays we offer.
  if (!upcomingSaturdays(BOOK_WEEKS).includes(date)) {
    return NextResponse.json({ error: "That date isn't available for booking." }, { status: 400 });
  }
  const when = parseKey(date);

  const blocked = await db.consignBlockedDate.findFirst({ where: { storeId: store.id, date: when } });
  if (blocked) return NextResponse.json({ error: "Sorry, that date isn't accepting appointments." }, { status: 409 });

  try {
    await db.consignAppointment.create({
      data: { storeId: store.id, date: when, slot, name: name.trim(), email, phone, note },
    });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Sorry, that time was just booked. Please pick another." }, { status: 409 });
    return NextResponse.json({ error: "Couldn't book the appointment. Please try again." }, { status: 500 });
  }

  // Send a confirmation email (best-effort; booking already succeeded).
  if (email) {
    try {
      await sendAppointmentEmail({
        to: email,
        name: name.trim(),
        storeName: store.name,
        dateLabel: prettyDate(date),
        timeLabel: slotLabel(slot),
        address: store.address,
      });
    } catch { /* don't fail the booking if email fails */ }
  }

  return NextResponse.json({ booked: true });
}
