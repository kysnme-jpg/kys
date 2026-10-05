import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// Diagnostic: directly checks whether an account exists and whether a given
// password matches the stored hash — bypassing NextAuth entirely. Gated by
// RESET_TOKEN so only the deployment owner can use it. Temporary.
export async function GET(req: NextRequest) {
  const token = process.env.RESET_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Diag disabled (set RESET_TOKEN)" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("token") !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const email = searchParams.get("email") || "";
  const password = searchParams.get("password") || "";

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  const found = !!user;
  const hasHash = !!user?.passwordHash;
  let passwordMatches = false;
  if (hasHash && password) {
    passwordMatches = await bcrypt.compare(password, user!.passwordHash!);
  }

  return NextResponse.json({
    found,
    emailStored: user?.email ?? null,
    hasHash,
    passwordMatches,
    role: user?.role ?? null,
    hasStore: !!user?.storeId,
    userCount: await db.user.count(),
  });
}
