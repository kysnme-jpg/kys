import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

function slugify(s: string): string {
  return (
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "my-shop"
  );
}

// Whether the platform still needs its first owner account.
export async function GET() {
  const userCount = await db.user.count();
  return NextResponse.json({ needsSetup: userCount === 0 });
}

// Create the first store + owner. Works ONLY while no users exist, so it locks
// itself the moment the owner is created — no secret token needed.
export async function POST(req: NextRequest) {
  const userCount = await db.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "This platform is already set up. Please log in." },
      { status: 409 }
    );
  }

  const { storeName, email, password } = await req.json();

  if (!storeName || !email || !password) {
    return NextResponse.json(
      { error: "Store name, email, and password are all required" },
      { status: 400 }
    );
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  let slug = slugify(storeName);
  if (await db.store.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction(async (tx: any) => {
    const store = await tx.store.create({
      data: { name: storeName, slug, email, taxRate: 0, currency: "USD" },
    });

    await tx.user.create({
      data: { name: "Store Owner", email, passwordHash, role: "OWNER", storeId: store.id },
    });

    await tx.category.createMany({
      data: [
        { storeId: store.id, name: "Clothing", slug: "clothing" },
        { storeId: store.id, name: "Shoes", slug: "shoes" },
        { storeId: store.id, name: "Accessories", slug: "accessories" },
        { storeId: store.id, name: "Home", slug: "home" },
      ],
    });
  });

  return NextResponse.json({ ok: true });
}
