import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";

async function getPortalConsignor(req: NextRequest) {
  const token =
    req.cookies.get("portal_token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.PORTAL_JWT_SECRET || "dev-secret")
    );
    if (payload.type !== "consignor-portal") return null;
    return payload.consignorId as string;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const consignorId = await getPortalConsignor(req);
  if (!consignorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const consignor = await db.consignor.findUnique({ where: { id: consignorId } });
  if (!consignor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (consignor.balance <= 0) {
    return NextResponse.json({ error: "No balance available to request" }, { status: 400 });
  }

  const { method, notes } = await req.json();

  // Create a pending payout record (store staff will approve/process it)
  const payout = await db.payout.create({
    data: {
      storeId: consignor.storeId,
      consignorId,
      amount: consignor.balance,
      method: method || "CHECK",
      status: "PENDING",
      note: notes
        ? `Portal request: ${notes}`
        : "Requested via consignor portal",
    },
  });

  return NextResponse.json({ requested: true, amount: consignor.balance, payoutId: payout.id });
}
