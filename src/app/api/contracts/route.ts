import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContractEmail } from "@/lib/email";

const DEFAULT_CONTRACT = (storeName: string, consignorName: string, splitPercent: number) => `
CONSIGNMENT AGREEMENT

This Consignment Agreement ("Agreement") is entered into between ${storeName} ("Store") and ${consignorName} ("Consignor").

1. CONSIGNMENT TERMS
   The Consignor agrees to leave items with the Store for sale on a consignment basis.
   The Consignor will receive ${splitPercent}% of the final selling price for each item sold.
   The Store retains ${100 - splitPercent}% as a commission for selling services.

2. ITEM ACCEPTANCE
   The Store reserves the right to accept or decline any item. Items must be clean,
   in working order, and accurately described by the Consignor.

3. PRICING
   The Store has final authority on pricing. The Consignor may suggest prices,
   which the Store will consider but is not obligated to use.

4. PAYOUT
   Consignor payments are processed on a schedule determined by the Store.
   Payments may be made by check, cash, or electronic transfer.

5. UNSOLD ITEMS
   Items not sold within the agreed consignment period may be returned to the
   Consignor or donated at the Store's discretion unless otherwise arranged.

6. LIABILITY
   The Store will take reasonable precautions to protect consigned items but is
   not responsible for loss, theft, or damage beyond normal retail care.

7. AGREEMENT
   By signing below, the Consignor agrees to all terms of this Agreement.
`.trim();

const schema = z.object({
  consignorId: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
  sendEmail: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const contracts = await db.contract.findMany({
    where: { storeId },
    include: {
      consignor: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contracts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const body = await req.json();
  const { consignorId, title, body: contractBody, sendEmail } = schema.parse(body);

  const [consignor, store] = await Promise.all([
    db.consignor.findFirst({ where: { id: consignorId, storeId } }),
    db.store.findUnique({ where: { id: storeId } }),
  ]);

  if (!consignor || !store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const finalBody = contractBody || DEFAULT_CONTRACT(
    store.name,
    `${consignor.firstName} ${consignor.lastName}`,
    consignor.splitPercent,
  );

  const contract = await db.contract.create({
    data: {
      storeId,
      consignorId,
      title: title || "Consignment Agreement",
      body: finalBody,
      splitPercent: consignor.splitPercent,
      status: "DRAFT",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  if (sendEmail && consignor.email) {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await sendContractEmail({
      to: consignor.email,
      consignorName: `${consignor.firstName} ${consignor.lastName}`,
      storeName: store.name,
      contractId: contract.id,
      signUrl: `${baseUrl}/portal/sign/${contract.id}`,
    });

    await db.contract.update({ where: { id: contract.id }, data: { status: "SENT" } });
  }

  return NextResponse.json(contract, { status: 201 });
}
