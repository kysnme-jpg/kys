import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendLayawayReminderNow } from "@/lib/reminders";

export const runtime = "nodejs";

// Staff "Send reminder" button: email this layaway's payment reminder right now.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await sendLayawayReminderNow((session.user as any).storeId, id);
  if (!result.ok) return NextResponse.json({ error: result.error || "Could not send the reminder.", to: result.to }, { status: 400 });
  return NextResponse.json({ sent: true, to: result.to });
}
