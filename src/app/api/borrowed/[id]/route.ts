import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveName } from "@/lib/names";

const parseDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;
  const body = await req.json();

  const existing = await db.borrowedGarment.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, any> = {};
  for (const k of ["borrowerName", "phone", "email", "idNumber", "items", "conditionPickup", "conditionDropoff"] as const) {
    if (body[k] !== undefined) data[k] = body[k] || (k === "borrowerName" || k === "items" ? existing[k] : null);
  }

  // Name: separate first/last fields (or a single full name from older callers).
  // The full name is always kept in sync for lists and emails.
  if (body.firstName !== undefined || body.lastName !== undefined) {
    const name = resolveName({ firstName: body.firstName ?? existing.firstName, lastName: body.lastName ?? existing.lastName });
    if (!name.firstName) return NextResponse.json({ error: "First name is required" }, { status: 400 });
    data.firstName = name.firstName; data.lastName = name.lastName || null; data.borrowerName = name.full;
  } else if (typeof body.borrowerName === "string" && body.borrowerName.trim()) {
    const name = resolveName({ full: body.borrowerName });
    data.firstName = name.firstName; data.lastName = name.lastName || null; data.borrowerName = name.full;
  }
  if (body.dryCleaning !== undefined) data.dryCleaning = body.dryCleaning || null;
  if (body.dateBorrowed !== undefined && body.dateBorrowed) data.dateBorrowed = parseDate(body.dateBorrowed);
  if (body.returnDate !== undefined) data.returnDate = body.returnDate ? parseDate(body.returnDate) : null;
  if (body.status !== undefined && ["OUT", "RETURNED"].includes(body.status)) data.status = body.status;

  await db.borrowedGarment.update({ where: { id }, data });
  return NextResponse.json({ updated: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const storeId = (session.user as any).storeId;

  const existing = await db.borrowedGarment.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.borrowedGarment.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
