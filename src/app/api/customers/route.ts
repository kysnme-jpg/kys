import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (email) {
    const customer = await db.customer.findFirst({
      where: { storeId, email: { equals: email, mode: "insensitive" } },
      select: { id: true, firstName: true, lastName: true, email: true, points: true },
    });
    return NextResponse.json({ customer: customer || null });
  }

  const customers = await db.customer.findMany({
    where: { storeId },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true, points: true, createdAt: true },
  });

  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = (session.user as any).storeId;
  const { firstName, lastName, email, phone } = await req.json();

  if (!firstName || !lastName) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const customer = await db.customer.create({
    data: { storeId, firstName, lastName, email, phone },
  });

  return NextResponse.json(customer, { status: 201 });
}
