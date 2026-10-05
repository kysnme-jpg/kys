import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface ImportItem {
  brand?: string | null;
  title: string;
  size?: string | null;
  price?: number | null;
  notes?: string | null;
}
interface ImportConsignor {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  splitPercent?: number;
  items?: ImportItem[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Only owners and managers can import" }, { status: 403 });
  }
  const storeId = (session.user as any).storeId;

  const body = await req.json();
  const consignors: ImportConsignor[] = body?.consignors;
  if (!Array.isArray(consignors)) {
    return NextResponse.json({ error: "Expected a { consignors: [...] } file" }, { status: 400 });
  }

  // Pre-load existing consignors (match by email) to avoid duplicates.
  const existing = await db.consignor.findMany({ where: { storeId }, select: { id: true, email: true } });
  const byEmail = new Map<string, string>();
  for (const c of existing) if (c.email) byEmail.set(c.email.toLowerCase(), c.id);

  let createdConsignors = 0;
  let createdItems = 0;
  let skippedItems = 0;

  for (const c of consignors) {
    const split = typeof c.splitPercent === "number" ? c.splitPercent : 50;
    let consignorId = c.email ? byEmail.get(String(c.email).toLowerCase()) : undefined;

    if (!consignorId) {
      const created = await db.consignor.create({
        data: {
          storeId,
          firstName: c.firstName || "Unknown",
          lastName: c.lastName || "",
          email: c.email || null,
          phone: c.phone || null,
          splitPercent: split,
        },
      });
      consignorId = created.id;
      createdConsignors++;
      if (c.email) byEmail.set(String(c.email).toLowerCase(), consignorId);
    }

    // Skip items whose title already exists for this consignor (idempotent re-runs).
    const existingItems = await db.item.findMany({ where: { storeId, consignorId }, select: { title: true } });
    const haveTitles = new Set(existingItems.map((i) => i.title));

    const toCreate = (c.items || [])
      .filter((it) => it.title && !haveTitles.has(String(it.title)))
      .map((it) => ({
        storeId,
        consignorId,
        title: String(it.title),
        brand: it.brand || null,
        size: it.size != null ? String(it.size) : null,
        price: typeof it.price === "number" ? it.price : 0,
        splitPercent: split,
        type: "CONSIGNED" as const,
        status: "ACTIVE" as const,
        photoUrls: [] as string[],
        listedOnline: false,
      }));

    skippedItems += (c.items || []).length - toCreate.length;
    if (toCreate.length) {
      await db.item.createMany({ data: toCreate });
      createdItems += toCreate.length;
    }
  }

  return NextResponse.json({ createdConsignors, createdItems, skippedItems });
}
