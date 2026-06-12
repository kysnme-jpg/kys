import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const store = await db.store.findUnique({ where: { id: storeId } });
  return NextResponse.json({ template: (store as any)?.contractTemplate || "" });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const { template } = await req.json();
  await db.store.update({ where: { id: storeId }, data: { contractTemplate: template || null } as any });
  return NextResponse.json({ saved: true });
}
