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

const PUBLIC_PATHS = ["/api/auth", "/login", "/setup", "/api/setup", "/reset", "/api/reset-password", "/api/diag", "/shop", "/api/shop", "/api/photos"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
