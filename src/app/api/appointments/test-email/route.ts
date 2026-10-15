import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTestEmail } from "@/lib/email";

// Staff: send a test email to confirm the Resend setup. Returns the real
// outcome (success id, or the exact error) so problems are visible.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  let to = "";
  try { to = (await req.json())?.to || ""; } catch { /* no body */ }
  to = (to || (session.user as any).email || "").trim();
  if (!to) return NextResponse.json({ ok: false, error: "No recipient email. Enter one or set an email on your account." }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId }, select: { name: true } });
  const result = await sendTestEmail(to, store?.name || "Classic Consigns by KYS");

  return NextResponse.json({ to, ...result }, { status: result.ok ? 200 : 502 });
}
