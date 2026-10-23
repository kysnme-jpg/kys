import { db } from "@/lib/db";

// Record an email in the activity log (best-effort — never throws).
export async function logEmail(data: {
  storeId: string;
  consignorId?: string | null;
  to: string;
  type: "INVENTORY" | "CONTRACT" | "APPOINTMENT" | "OTHER";
  subject?: string;
  status?: "SENT" | "TEST" | "FAILED";
}) {
  try {
    await db.emailLog.create({
      data: {
        storeId: data.storeId,
        consignorId: data.consignorId || null,
        to: data.to,
        type: data.type,
        subject: data.subject || null,
        status: data.status || "SENT",
      },
    });
  } catch { /* logging must never break the request */ }
}
