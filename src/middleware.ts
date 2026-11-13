import { NextRequest, NextResponse } from "next/server";

// Edge-safe middleware: it only does coarse UX gating (redirect to /login when
// there's no session cookie). It must NOT import the full auth config, which
// pulls in Prisma, the pg driver, and bcrypt — none of which run in the Edge
// runtime. Real authentication is enforced server-side in every page and API
// route via auth() (Node runtime), so a forged cookie still gets a 401 there.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

// The consignor/dealer portal has its OWN login (a portal token, not a staff
// session), so its pages and API must be reachable without a staff cookie —
// each portal route verifies the portal token itself.
const PUBLIC_PATHS = [
  "/api/auth", "/login", "/setup", "/api/setup", "/reset", "/api/reset-password",
  "/shop", "/api/shop", "/api/photos", "/book", "/api/book", "/api/cron",
  "/sip-and-shop", "/api/sip-and-shop", "/welcome", "/api/checkin", "/api/contracts/",
  "/portal", "/api/portal", "/dealer", "/api/dealer",
  "/api/webhooks/shopify", // verifies Shopify's signature itself (fail-closed)
];

// Shared endpoints the portal also calls with its Bearer token. They resolve and
// verify the caller themselves; only let them past the cookie check when a
// Bearer token is actually presented.
const BEARER_PATHS = [/^\/api\/posts\/feed$/, /^\/api\/posts\/[^/]+\/rsvp$/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"));
  if (isPublic) return NextResponse.next();

  if (req.headers.get("authorization")?.startsWith("Bearer ") && BEARER_PATHS.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
