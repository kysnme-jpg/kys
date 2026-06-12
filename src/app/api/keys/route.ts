import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

function generateKey(): { raw: string; hash: string; prefix: string } {
  const raw = `cp_live_${crypto.randomBytes(24).toString("base64url")}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 14); // "cp_live_XXXXXX"
  return { raw, hash, prefix };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storeId = (session.user as any).storeId;
  const keys = await db.apiKey.findMany({
    where: { storeId },
    select: { id: true, name: true, keyPrefix: true, active: true, lastUsedAt: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storeId = (session.user as any).storeId;
  const { name, expiresAt } = await req.json();

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { raw, hash, prefix } = generateKey();

  const key = await db.apiKey.create({
    data: {
      storeId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    },
  });

  // Return the raw key ONCE — never stored in plain text
  return NextResponse.json({ id: key.id, name: key.name, key: raw, prefix }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const { id } = await req.json();

  await db.apiKey.updateMany({
    where: { id, storeId },
    data: { active: false },
  });

  return NextResponse.json({ revoked: true });
}
