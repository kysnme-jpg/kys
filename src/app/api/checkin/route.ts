import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

// Public: store info for the kiosk welcome page.
export async function GET(_req: NextRequest) {
  const store = await db.store.findFirst({ select: { name: true } });
  if (!store) return NextResponse.json({ error: "Store not configured" }, { status: 503 });
  return NextResponse.json({ store: { name: store.name } });
}

const schema = z.object({
  firstName: z.string().min(1, "Please enter your first name"),
  lastName: z.preprocess(emptyToUndef, z.string().optional()),
  email: z.preprocess(emptyToUndef, z.string().email("Enter a valid email").optional()),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  birthday: z.preprocess(emptyToUndef, z.string().regex(/^\d{2}-\d{2}$/).optional()),
  source: z.preprocess(emptyToUndef, z.string().optional()),
});

// Public: a customer checks in / joins the loyalty list from the kiosk.
export async function POST(req: NextRequest) {
  const store = await db.store.findFirst({ select: { id: true } });
  if (!store) return NextResponse.json({ error: "Store not configured" }, { status: 503 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid info" }, { status: 400 });
  const d = parsed.data;

  if (!d.email && !d.phone) {
    return NextResponse.json({ error: "Please add an email or phone so we can reach you." }, { status: 400 });
  }

  // Find an existing customer by email or phone to avoid duplicates.
  const existing = await db.customer.findFirst({
    where: {
      storeId: store.id,
      OR: [
        ...(d.email ? [{ email: { equals: d.email, mode: "insensitive" as const } }] : []),
        ...(d.phone ? [{ phone: d.phone }] : []),
      ],
    },
  });

  if (existing) {
    // Fill in any blanks without overwriting existing data or points.
    await db.customer.update({
      where: { id: existing.id },
      data: {
        firstName: existing.firstName || d.firstName,
        lastName: existing.lastName || d.lastName || "",
        email: existing.email || d.email || null,
        phone: existing.phone || d.phone || null,
        birthday: existing.birthday || d.birthday || null,
        source: existing.source || d.source || null,
      },
    });
    return NextResponse.json({ ok: true, returning: true, firstName: existing.firstName || d.firstName });
  }

  await db.customer.create({
    data: {
      storeId: store.id,
      firstName: d.firstName.trim(),
      lastName: (d.lastName || "").trim(),
      email: d.email || null,
      phone: d.phone || null,
      birthday: d.birthday || null,
      source: d.source || null,
    },
  });

  return NextResponse.json({ ok: true, returning: false, firstName: d.firstName.trim() });
}
