import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fireWebhook } from "@/lib/webhooks";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { signatureData } = await req.json();

  if (!signatureData) return NextResponse.json({ error: "Signature required" }, { status: 400 });

  const contract = await db.contract.findUnique({ where: { id } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status === "SIGNED") return NextResponse.json({ error: "Already signed" }, { status: 409 });
  if (contract.expiresAt && contract.expiresAt < new Date()) {
    return NextResponse.json({ error: "Contract link has expired" }, { status: 410 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  const updated = await db.contract.update({
    where: { id },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
      signatureData,
      signerIp: ip,
    },
    include: {
      consignor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Mark consignor contract signed date
  await db.consignor.update({
    where: { id: contract.consignorId },
    data: { contractSignedAt: new Date() },
  });

  fireWebhook(contract.storeId, "contract.signed", {
    contractId: id,
    consignorId: contract.consignorId,
    signedAt: updated.signedAt,
  }).catch(() => {});

  return NextResponse.json({ signed: true, signedAt: updated.signedAt });
}
