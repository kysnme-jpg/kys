import { NextResponse } from "next/server";
import { clearPortalCookie } from "@/lib/portal-session";

// Sign the consignor out by clearing the portal sign-in cookie.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearPortalCookie(res);
  return res;
}
