import type { NextRequest, NextResponse } from "next/server";

/**
 * Consignor-portal sign-in token.
 *
 * The token travels two ways: as an httpOnly cookie for the whole site (so the
 * portal works even on phones that block site storage — Safari's "Block All
 * Cookies"-style privacy settings, some privacy browsers and email apps'
 * built-in browsers), and as an `Authorization: Bearer` header the portal pages
 * add from localStorage when storage is available. An explicit Bearer wins over
 * the cookie, so a staff "Preview portal" tab always shows the consignor being
 * previewed.
 */

export const PORTAL_COOKIE = "portal_token";
const MAX_AGE = 60 * 60 * 24 * 7; // matches the token's 7-day expiry

export function portalTokenFrom(req: NextRequest): string | undefined {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer && bearer !== "null" && bearer !== "undefined") return bearer;
  }
  return req.cookies.get(PORTAL_COOKIE)?.value || undefined;
}

// Cookies are written as raw Set-Cookie headers: the framework's cookie helper
// keeps one entry per name, so clearing the old /portal copy through it would
// overwrite the new site-wide cookie in the same response.
function cookieHeader(value: string, path: string, maxAge: number): string {
  const parts = [`${PORTAL_COOKIE}=${value}`, `Path=${path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function setPortalCookie(res: NextResponse, token: string): void {
  res.headers.append("Set-Cookie", cookieHeader(token, "/", MAX_AGE)); // sameSite=lax: never sent on cross-site form posts
  // Older sign-ins stored the cookie only under /portal; drop that copy.
  res.headers.append("Set-Cookie", cookieHeader("", "/portal", 0));
}

export function clearPortalCookie(res: NextResponse): void {
  for (const path of ["/", "/portal"]) res.headers.append("Set-Cookie", cookieHeader("", path, 0));
}
