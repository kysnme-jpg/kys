// The app's PUBLIC base URL for links in emails. Never use new URL(req.url).origin
// directly — behind Railway's proxy that resolves to the internal host
// (e.g. https://localhost:8080), which breaks links sent to customers.
export function getBaseUrl(req?: { url: string }): string {
  const env = (process.env.NEXTAUTH_URL || "").trim();
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env.replace(/\/+$/, "");

  // Railway injects this automatically (e.g. "data-production-5b03.up.railway.app").
  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || "").trim();
  if (railway) return `https://${railway.replace(/\/+$/, "")}`;

  // Last resort: the request origin (only correct in local dev).
  if (req) {
    try { return new URL(req.url).origin; } catch { /* ignore */ }
  }
  return "http://localhost:3000";
}
