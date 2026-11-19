import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSKU } from "@/lib/utils";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_PIECES = 50;

const schema = z.object({
  pieces: z.number().int().min(2, "Split into at least 2 pieces").max(MAX_PIECES, `At most ${MAX_PIECES} pieces`),
  priceEach: z.number().positive("Enter a price for each piece"),
  title: z.string().trim().min(1, "Enter a name for the pieces").max(120).optional(),
});

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Split one item (e.g. a jewelry set) into separate pieces, each its own item
 * with its own SKU and tag, so pieces can sell — and credit the consignor —
 * one at a time. The original item is replaced by the pieces.
 *
 * Only an unsold item with no sales history can be split; anything already
 * tied to a sale stays as it is.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const { pieces } = parsed.data;
  const priceEach = cents(parsed.data.priceEach);

  const item = await db.item.findFirst({ where: { id, storeId }, include: { _count: { select: { saleItems: true } } } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (item.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active (unsold) item can be split into pieces." }, { status: 400 });
  }
  if (item._count.saleItems > 0) {
    return NextResponse.json({ error: "This item has sales history, so it can't be split. Add the pieces as new items instead." }, { status: 400 });
  }

  const baseTitle = (parsed.data.title || item.title).trim();
  const costEach = item.costPrice != null ? cents(item.costPrice / pieces) : null;

  try {
    const created = await db.$transaction(async (tx) => {
      const out = [];
      for (let i = 1; i <= pieces; i++) {
        out.push(
          await tx.item.create({
            data: {
              storeId,
              consignorId: item.consignorId,
              categoryId: item.categoryId,
              sku: generateSKU(),
              title: `${baseTitle} — ${i} of ${pieces}`,
              description: item.description,
              brand: item.brand,
              size: item.size,
              color: item.color,
              condition: item.condition,
              type: item.type,
              status: "ACTIVE",
              price: priceEach,
              costPrice: costEach,
              location: item.location,
              splitPercent: item.splitPercent,
              photoUrls: item.photoUrls,
              listedOnline: item.listedOnline,
              expiresAt: item.expiresAt,
            },
            select: { id: true, sku: true, barcode: true, title: true, price: true, size: true, brand: true, condition: true },
          }),
        );
      }
      // The pieces replace the original. Re-check inside the transaction that it
      // hasn't been sold meanwhile; if it has, everything rolls back.
      const removed = await tx.item.deleteMany({ where: { id: item.id, storeId, status: "ACTIVE", saleItems: { none: {} } } });
      if (removed.count !== 1) throw new Error("ITEM_CHANGED");
      return out;
    });

    return NextResponse.json({ pieces: created, consignorId: item.consignorId }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "ITEM_CHANGED") {
      return NextResponse.json({ error: "This item was just sold or changed. Refresh and try again." }, { status: 409 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Couldn't create unique SKUs. Please try again." }, { status: 409 });
    }
    throw err;
  }
}
