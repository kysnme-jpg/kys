import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Allow public access for signing (no auth required — link is the secret)
  const contract = await db.contract.findUnique({
    where: { id },
    include: {
      consignor: { select: { firstName: true, lastName: true, email: true } },
      store: { select: { name: true, logoUrl: true } },
    },
  });

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // Don't expose signature data to public requests
  const { signatureData, signerIp, ...safe } = contract as any;

  // Check if request is from dashboard (has auth)
  const session = await auth();
  if (session?.user) {
    return NextResponse.json(contract); // Full data for staff
  }

  return NextResponse.json(safe);
}
