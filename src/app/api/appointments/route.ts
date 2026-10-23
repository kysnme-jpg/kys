import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { upcomingSaturdays, dateKey, slotLabel, prettyDate, formatTime, MAX_APPTS_PER_DAY, CUSTOM_SLOT_BASE } from "@/lib/appointments";
import { sendAppointmentEmail } from "@/lib/email";
import { logEmail } from "@/lib/email-log";

const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
const mapAppt = (a: any) => ({ id: a.id, slot: a.slot, startTime: a.startTime, name: a.name, email: a.email, phone: a.phone, note: a.note });

// Staff: list upcoming Saturdays (+ extras) and any other-day appointments.
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const keys = upcomingSaturdays(10);
  const satSet = new Set(keys);
  const todayKey = new Date().toISOString().slice(0, 10);
  const from = parseKey(todayKey < keys[0] ? todayKey : keys[0]);

  const [appts, blocks] = await Promise.all([
    db.consignAppointment.findMany({ where: { storeId, date: { gte: from } }, orderBy: [{ date: "asc" }, { slot: "asc" }] }),
    db.consignBlockedDate.findMany({ where: { storeId, date: { gte: from } } }),
  ]);

  const stdByDay: Record<string, any[]> = {};   // slot 0-3
  const extraByDay: Record<string, any[]> = {};  // slot >= CUSTOM_SLOT_BASE
  for (const a of appts) {
    const k = dateKey(a.date);
    (a.slot >= CUSTOM_SLOT_BASE ? (extraByDay[k] ||= []) : (stdByDay[k] ||= [])).push(mapAppt(a));
  }
  const blockedByDay: Record<string, string | null> = {};
  for (const b of blocks) blockedByDay[dateKey(b.date)] = b.reason ?? null;

  const saturdays = keys.map((date) => ({
    date,
    blocked: date in blockedByDay,
    blockedReason: blockedByDay[date] ?? null,
    appointments: stdByDay[date] ?? [],
    extras: extraByDay[date] ?? [],
  }));

  // Appointments on any day NOT in the upcoming-Saturdays grid (Wed/Thu/Fri,
  // custom Saturdays beyond the window, etc.) grouped by date.
  const otherMap: Record<string, any[]> = {};
  for (const a of appts) {
    const k = dateKey(a.date);
    if (satSet.has(k)) continue;
    (otherMap[k] ||= []).push(mapAppt(a));
  }
  const otherDays = Object.keys(otherMap).sort().map((date) => ({ date, appointments: otherMap[date] }));

  return NextResponse.json({ saturdays, otherDays });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.number().int().min(0).max(MAX_APPTS_PER_DAY - 1).optional()),
  time: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^\d{1,2}:\d{2}$/).optional()),
  name: z.string().min(1, "Name is required"),
  email: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  phone: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  note: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

// Staff: add an appointment — either a standard Saturday slot (slot 0-3) or a
// custom any-day/any-time one (time set; gets a custom slot number).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  const { date, name, email, phone, note } = parsed.data;
  let { slot, time } = parsed.data;

  const when = parseKey(date);
  let startTime: string | null = null;
  let timeLabel: string;

  if (time) {
    // Custom appointment: assign the next free custom slot for that day.
    startTime = time;
    timeLabel = formatTime(time);
    const last = await db.consignAppointment.findFirst({
      where: { storeId, date: when, slot: { gte: CUSTOM_SLOT_BASE } },
      orderBy: { slot: "desc" },
    });
    slot = last ? last.slot + 1 : CUSTOM_SLOT_BASE;
  } else if (slot !== undefined) {
    timeLabel = slotLabel(slot);
  } else {
    return NextResponse.json({ error: "Pick a slot or a time." }, { status: 400 });
  }

  try {
    await db.consignAppointment.create({ data: { storeId, date: when, slot: slot as number, startTime, name: name.trim(), email, phone, note } });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "That slot is already booked." }, { status: 409 });
    return NextResponse.json({ error: "Couldn't save the appointment." }, { status: 500 });
  }

  if (email) {
    try {
      const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true, address: true } });
      if (store) {
        await sendAppointmentEmail({ to: email, name: name.trim(), storeName: store.name, dateLabel: prettyDate(date), timeLabel, address: store.address });
        await logEmail({ storeId, to: email, type: "APPOINTMENT", subject: `Appointment — ${prettyDate(date)} ${timeLabel}` });
      }
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ created: true }, { status: 201 });
}
