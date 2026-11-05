import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getPortalConsignor } from "../me/route";

// A consignor sets their own password (used for the forced reset after the
// store resends access with a temporary one).
export async function POST(req: NextRequest) {
  const session = await getPortalConsignor(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password } = await req.json();
  const pw = String(password || "");
  if (pw.length < 6) {
    return NextResponse.json({ error: "Choose a password of at least 6 characters." }, { status: 400 });
  }

  await db.consignor.update({
    where: { id: session.id },
    data: { portalPassword: await bcrypt.hash(pw, 10), portalMustReset: false },
  });

  return NextResponse.json({ ok: true });
}
