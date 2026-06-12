import { NextRequest } from "next/server";
import { db } from "./db";
import crypto from "crypto";

export async function authenticateApiKey(req: NextRequest): Promise<{ storeId: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer cp_")) return null;

  const raw = authHeader.replace("Bearer ", "");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");

  const key = await db.apiKey.findFirst({
    where: {
      keyHash: hash,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!key) return null;

  // Update last used (fire and forget)
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { storeId: key.storeId };
}
