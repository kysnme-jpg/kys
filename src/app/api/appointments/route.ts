import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { upcomingSaturdays, dateKey, slotLabel, prettyDate, MAX_APPTS_PER_DAY } from "@/lib/appointments";
import { sendAppointmentEmail } from "@/lib/email";

const parseKey = (key: string) => new Date(`${key}T00:00:00.000Z`);

// Staff: list upcoming Saturdays with their appointments + blocks.
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const keys = upcomingSaturdays(10);
  const from = parseKey(keys[0]);

  const [appts, blocks] = await Promise.all([
    db.consignAppointment.findMany({ where: { storeId, date: { gte: from } }, orderBy: [{ date: "asc" }, { slot: "asc" }] }),
    db.consignBlockedDate.findMany({ where: { storeId, date: { gte: from } } }),
  ]);

  const byDay: Record<string, any[]> = {};
  for (const a of appts) (byDay[dateKey(a.date)] ||= []).push({ id: a.id, slot: a.slot, name: a.name, email: a.email, phone: a.phone, note: a.note });
  const blockedByDay: Record<string, string | null> = {};
  for (const b of blocks) blockedByDay[dateKey(b.date)] = b.reason ?? null;

  const saturdays = keys.map((date) => ({
    date,
    blocked: date in blockedByDay,
    blockedReason: blockedByDay[date] ?? null,
    appointments: byDay[date] ?? [],
  }));

  return NextResponse.json({ saturdays });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.number().int().min(0).max(MAX_APPTS_PER_DAY - 1),
  name: z.string().min(1, "Name is required"),
  email: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  phone: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  note: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});

// Staff: manually add an appointment.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  const { date, slot, name, email, phone, note } = parsed.data;

  try {
    await db.consignAppointment.create({ data: { storeId, date: parseKey(date), slot, name: name.trim(), email, phone, note } });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "That slot is already booked." }, { status: 409 });
    return NextResponse.json({ error: "Couldn't save the appointment." }, { status: 500 });
  }

  if (email) {
    try {
      const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true, address: true } });
      if (store) {
        await sendAppointmentEmail({ to: email, name: name.trim(), storeName: store.name, dateLabel: prettyDate(date), timeLabel: slotLabel(slot), address: store.address });
      }
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ created: true }, { status: 201 });
}
