import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendLayawayAgreementEmail } from "@/lib/email";
import { processDueReminders } from "@/lib/reminders";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const num = (def = 0) => z.preprocess((v) => (v === "" || v == null ? def : Number(v)), z.number().min(0));

const schema = z.object({
  buyerName: z.string().min(1, "Buyer name is required"),
  address: z.preprocess(emptyToUndef, z.string().optional()),
  cityStateZip: z.preprocess(emptyToUndef, z.string().optional()),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  email: z.preprocess(emptyToUndef, z.string().email("Enter a valid email").optional()),
  items: z.string().min(1, "Please list the item(s)"),
  totalPrice: num(0),
  serviceFee: num(5),
  deposit: num(0),
  payment2: num(0),
  payment3: num(0),
  finalPayment: num(0),
  startDate: z.preprocess(emptyToUndef, z.string().optional()),
});

const fmtDue = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  // Opportunistically send any reminders that have come due.
  try { await processDueReminders(storeId); } catch { /* ignore */ }

  const layaways = await db.layaway.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ layaways });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  const d = parsed.data;
  const startDate = d.startDate ? new Date(`${d.startDate}T00:00:00.000Z`) : new Date();

  const layaway = await db.layaway.create({
    data: {
      storeId,
      buyerName: d.buyerName.trim(),
      address: d.address, cityStateZip: d.cityStateZip, phone: d.phone, email: d.email,
      items: d.items,
      totalPrice: d.totalPrice, serviceFee: d.serviceFee,
      deposit: d.deposit, payment2: d.payment2, payment3: d.payment3, finalPayment: d.finalPayment,
      amountPaid: d.deposit, // deposit is paid today
      startDate,
    },
  });

  const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
  if (d.email) {
    try {
      await sendLayawayAgreementEmail({
        to: d.email,
        buyerName: d.buyerName.trim(),
        storeName: store?.name || "Classic Consigns by KYS",
        items: d.items,
        totalPrice: d.totalPrice,
        serviceFee: d.serviceFee,
        deposit: d.deposit, payment2: d.payment2, payment3: d.payment3, finalPayment: d.finalPayment,
        dueDates: { p2: fmtDue(addDays(startDate, 15)), p3: fmtDue(addDays(startDate, 30)), final: fmtDue(addDays(startDate, 45)) },
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json(layaway, { status: 201 });
}
