import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.PORTAL_JWT_SECRET || process.env.NEXTAUTH_SECRET || "portal-secret-change-me"
);

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const consignor = await db.consignor.findFirst({
    where: { email: email.toLowerCase().trim(), portalEnabled: true },
    include: { store: { select: { name: true, slug: true } } },
  });

  if (!consignor?.portalPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, consignor.portalPassword);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Issue a short-lived JWT for the portal session
  const token = await new SignJWT({
    sub: consignor.id,
    storeId: consignor.storeId,
    type: "consignor-portal",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(PORTAL_SECRET);

  const res = NextResponse.json({
    token,
    consignor: {
      id: consignor.id,
      firstName: consignor.firstName,
      lastName: consignor.lastName,
      email: consignor.email,
      storeName: consignor.store.name,
    },
  });

  // Also set as httpOnly cookie
  res.cookies.set("portal_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/portal",
  });

  return res;
}
