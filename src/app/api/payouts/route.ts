import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendPayoutEmail } from "@/lib/email";
import { fireWebhook } from "@/lib/webhooks";

const createPayoutSchema = z.object({
  consignorId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["CHECK", "CASH", "ACH"]).default("CHECK"),
  checkNumber: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const body = await req.json();
  const data = createPayoutSchema.parse(body);

  const consignor = await db.consignor.findFirst({
    where: { id: data.consignorId, storeId },
  });

  if (!consignor) return NextResponse.json({ error: "Consignor not found" }, { status: 404 });
  if (consignor.balance < data.amount) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const payout = await db.$transaction(async (tx: any) => {
    const payout = await tx.payout.create({
      data: {
        storeId,
        consignorId: data.consignorId,
        amount: data.amount,
        method: data.method,
        checkNumber: data.checkNumber,
        note: data.note,
        status: data.method === "ACH" ? "PROCESSING" : "COMPLETED",
        completedAt: data.method !== "ACH" ? new Date() : undefined,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        consignorId: data.consignorId,
        payoutId: payout.id,
        type: "PAYOUT_DEBIT",
        amount: -data.amount,
        note: `Payout via ${data.method}${data.checkNumber ? ` #${data.checkNumber}` : ""}`,
      },
    });

    await tx.consignor.update({
      where: { id: data.consignorId },
      data: { balance: { decrement: data.amount } },
    });

    return payout;
  });

  // Non-blocking notifications
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (consignor.email && store) {
    sendPayoutEmail({
      to: consignor.email,
      consignorName: `${consignor.firstName} ${consignor.lastName}`,
      amount: data.amount,
      method: data.method,
      checkNumber: data.checkNumber,
      storeName: store.name,
    }).catch(() => {});
  }
  fireWebhook(storeId, "payout.created", { payoutId: payout.id, amount: data.amount, method: data.method }).catch(() => {});

  return NextResponse.json(payout, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;

  const payouts = await db.payout.findMany({
    where: { storeId },
    include: {
      consignor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ payouts });
}
