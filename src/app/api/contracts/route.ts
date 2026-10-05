import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendContractEmail } from "@/lib/email";

const DEFAULT_CONTRACT = (storeName: string, consignorName: string, splitPercent: number) => `
${storeName} — Consignment Agreement

This agreement is between ${storeName} and ${consignorName} ("Consignor").

ITEMS WE ACCEPT
• Clothing purchased within the last 5 years or vintage pieces
• Clean / dry cleaned and in good or excellent condition
• In-style, classic, or timeless fashions
• Designer labels & boutique items
• Women's and men's clothing
• Handbags, shoes, belts, accessories, and jewelry

APPOINTMENT POLICY
• Consignment is by appointment only, available on Saturdays.
• First-time consignors may bring up to 10 clothing items and unlimited shoes, bags, and jewelry.

TERMS & CONDITIONS
• ${storeName} determines sale price and reserves the right to refuse any item. Please identify any high-value items when dropping them off.
• Unaccepted items will be returned within 30 days.
• The consignor will receive ${splitPercent}% of the sale price, excluding any fees for cleaning, mending, or similar services.
• Prices may be reduced by up to 25% and are subject to sales and promotions.
• The consignment period for designer items is four months (seasonal/exceptional items extending to 6 months). Consignors can request a pickup of unsold items anytime. Please allow 7 days for staff to gather your items.
• Payments are made via check, Zelle, PayPal, or Cash App only. No cash payments.
• While great care is taken with all items, ${storeName} is not responsible for missing or damaged items.

COMMISSIONS & PAYMENTS
• Consignors receive ${splitPercent}% of the final sale price.
• Payments are processed during the last 3 days & first 3 days each month once an account reaches a $100 balance.
• You may use your balance as boutique credit or request payment in person on Saturdays.

FINE PRINT
• Items are consigned with the understanding that pricing is set by ${storeName}.
• If a flaw is discovered after acceptance, the item may be photographed & discarded/donated, and/or held for pickup.
• All items remain in the boutique until sold or until the consignor requests their return.

ACKNOWLEDGMENT
By signing below, you ( ${consignorName} ) agree to the terms outlined in this agreement.
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

  const consignorName = `${consignor.firstName} ${consignor.lastName}`;
  const customTemplate = (store as any).contractTemplate as string | null | undefined;
  const finalBody = contractBody || (customTemplate
    ? customTemplate
        .replace(/\{\{storeName\}\}/g, store.name)
        .replace(/\{\{consignorName\}\}/g, consignorName)
        .replace(/\{\{splitPercent\}\}/g, String(consignor.splitPercent))
    : DEFAULT_CONTRACT(store.name, consignorName, consignor.splitPercent));

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
