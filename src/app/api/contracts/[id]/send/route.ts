import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendContractEmail } from "@/lib/email";
import { logEmail } from "@/lib/email-log";

// Staff: (re)send a contract's signing link by email. Optional { to } overrides
// the recipient (e.g. to fix a wrong email). Marks the contract SENT.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const body = await req.json().catch(() => ({}));
  const contract = await db.contract.findFirst({
    where: { id, storeId },
    include: { consignor: { select: { firstName: true, lastName: true, email: true } }, store: { select: { name: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status === "SIGNED") return NextResponse.json({ error: "This contract is already signed." }, { status: 400 });

  const to = (body.to || contract.consignor?.email || "").trim();
  if (!to) return NextResponse.json({ error: "No email on file. Enter an email to send to." }, { status: 400 });

  const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  try {
    await sendContractEmail({
      to,
      consignorName: `${contract.consignor?.firstName ?? ""} ${contract.consignor?.lastName ?? ""}`.trim(),
      storeName: contract.store?.name || "Classic Consigns by KYS",
      contractId: contract.id,
      signUrl: `${baseUrl}/portal/sign/${contract.id}`,
    });
  } catch (err: any) {
    await logEmail({ storeId, consignorId: contract.consignorId, to, type: "CONTRACT", subject: contract.title, status: "FAILED" });
    return NextResponse.json({ error: err?.message || "Couldn't send the email." }, { status: 502 });
  }

  if (contract.status !== "SENT") {
    await db.contract.update({ where: { id }, data: { status: "SENT" } });
  }
  await logEmail({ storeId, consignorId: contract.consignorId, to, type: "CONTRACT", subject: `${contract.title} (signing link)`, status: "SENT" });

  return NextResponse.json({ sent: true, to });
}
