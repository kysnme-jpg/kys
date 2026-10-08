import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

const workLogSchema = z.object({
  employeeName: z.string().min(1, "Employee name is required"),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  date: z.preprocess(emptyToUndef, z.string().optional()),
  hours: z.preprocess((v) => (v === "" || v === null || v === undefined ? 0 : Number(v)), z.number().min(0)),
  payout: z.preprocess((v) => (v === "" || v === null || v === undefined ? 0 : Number(v)), z.number().min(0)),
  note: z.preprocess(emptyToUndef, z.string().optional()),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const workLogs = await db.workLog.findMany({
    where: { storeId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ workLogs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const body = await req.json();
  const parsed = workLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  }
  const { employeeName, phone, date, hours, payout, note } = parsed.data;

  const workLog = await db.workLog.create({
    data: {
      storeId,
      employeeName,
      phone,
      date: date ? new Date(date) : new Date(),
      hours,
      payout,
      note,
    },
  });

  return NextResponse.json(workLog, { status: 201 });
}
