import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// Owner password reset, gated by the RESET_TOKEN env var. Only someone who can
// set environment variables on the deployment (the owner) can enable or use it.
export async function POST(req: NextRequest) {
  const token = process.env.RESET_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Password reset is disabled. Add a RESET_TOKEN variable to enable it." },
      { status: 403 }
    );
  }

  const { token: provided, email, newPassword } = await req.json();

  if (provided !== token) {
    return NextResponse.json({ error: "Invalid reset token." }, { status: 403 });
  }
  if (!email || !newPassword || String(newPassword).length < 8) {
    return NextResponse.json(
      { error: "Email and a new password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const user = await db.user.findFirst({
    where: { email: { equals: String(email), mode: "insensitive" } },
  });
  if (!user) {
    return NextResponse.json({ error: "No account found with that email." }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true, email: user.email });
}
