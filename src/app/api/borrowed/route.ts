import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendBorrowedAgreementEmail } from "@/lib/email";
import { processDueReminders } from "@/lib/reminders";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

const schema = z.object({
  borrowerName: z.string().min(1, "Borrower name is required"),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  email: z.preprocess(emptyToUndef, z.string().email("Enter a valid email").optional()),
  idNumber: z.preprocess(emptyToUndef, z.string().optional()),
  dateBorrowed: z.preprocess(emptyToUndef, z.string().optional()),
  returnDate: z.preprocess(emptyToUndef, z.string().optional()),
  items: z.string().min(1, "Please list the item(s)"),
  conditionPickup: z.preprocess(emptyToUndef, z.string().optional()),
  conditionDropoff: z.preprocess(emptyToUndef, z.string().optional()),
  dryCleaning: z.preprocess(emptyToUndef, z.enum(["BORROWER", "NOT_BORROWER", "UPON_RETURN"]).optional()),
});

const parseDate = (s?: string) => (s ? new Date(`${s}T00:00:00.000Z`) : undefined);
const fmt = (d?: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  try { await processDueReminders(storeId); } catch { /* ignore */ }

  const borrowed = await db.borrowedGarment.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ borrowed });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  const d = parsed.data;
  const dateBorrowed = parseDate(d.dateBorrowed) || new Date();
  const returnDate = parseDate(d.returnDate) || null;

  const record = await db.borrowedGarment.create({
    data: {
      storeId,
      borrowerName: d.borrowerName.trim(),
      phone: d.phone, email: d.email, idNumber: d.idNumber,
      dateBorrowed, returnDate,
      items: d.items,
      conditionPickup: d.conditionPickup, conditionDropoff: d.conditionDropoff,
      dryCleaning: d.dryCleaning,
    },
  });

  const store = await db.store.findUnique({ where: { id: storeId }, select: { name: true } });
  if (d.email) {
    try {
      await sendBorrowedAgreementEmail({
        to: d.email,
        borrowerName: d.borrowerName.trim(),
        storeName: store?.name || "Classic Consigns by KYS",
        items: d.items,
        dateBorrowed: fmt(dateBorrowed) || "",
        returnDate: fmt(returnDate),
        dryCleaning: d.dryCleaning,
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json(record, { status: 201 });
}
