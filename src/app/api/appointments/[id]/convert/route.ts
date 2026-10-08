import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Staff: turn a completed appointment into a new consignor record, then remove
// the appointment from the calendar. If a consignor with the same email already
// exists, reuse it instead of creating a duplicate.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const appt = await db.consignAppointment.findFirst({ where: { id, storeId } });
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Split the single name field into first / last.
  const parts = appt.name.trim().split(/\s+/);
  const firstName = parts[0] || appt.name.trim();
  const lastName = parts.slice(1).join(" ") || "—";

  let consignor = appt.email ? await db.consignor.findFirst({ where: { storeId, email: appt.email } }) : null;
  const reused = !!consignor;
  if (!consignor) {
    consignor = await db.consignor.create({
      data: {
        storeId,
        firstName,
        lastName,
        email: appt.email || null,
        phone: appt.phone || null,
        splitPercent: 50,
        notes: appt.note ? `From appointment: ${appt.note}` : null,
      },
    });
  }

  // Remove the appointment now that it's converted.
  await db.consignAppointment.delete({ where: { id } });

  return NextResponse.json({ consignorId: consignor.id, reused });
}
