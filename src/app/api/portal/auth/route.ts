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

  // Case-insensitive email match (consistent with staff login), tolerant of
  // stray capitalisation/whitespace in the stored or typed address. We look at
  // ALL portal-enabled consignors with that email (there can be duplicates) and
  // accept the password if it matches any of them.
  const candidates = await db.consignor.findMany({
    where: { email: { equals: String(email).trim(), mode: "insensitive" }, portalEnabled: true },
    include: { store: { select: { name: true, slug: true } } },
    omit: { portalPassword: false }, // needed to verify the password
  });

  // Trim the password (kills a trailing space/newline from copy-pasting the
  // email). For a temporary password (forced-reset state) we also accept it
  // case-insensitively, since temp passwords are hard to type exactly on a
  // phone. A consignor's own chosen password stays an exact match.
  const pw = String(password).trim();
  let consignor: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    if (!c.portalPassword) continue;
    let valid = await bcrypt.compare(pw, c.portalPassword);
    if (!valid && c.portalMustReset) valid = await bcrypt.compare(pw.toUpperCase(), c.portalPassword);
    if (valid) { consignor = c; break; }
  }
  if (!consignor) {
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
