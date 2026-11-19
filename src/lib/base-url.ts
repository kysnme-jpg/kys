// The app's PUBLIC base URL for links in emails. Never use new URL(req.url).origin
// directly — behind Railway's proxy that resolves to the internal host
// (e.g. https://localhost:8080), which breaks links sent to customers.

const isLocal = (host: string) => /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(host);

export function getBaseUrl(req?: { url: string; headers?: { get(name: string): string | null } }): string {
  const env = (process.env.NEXTAUTH_URL || "").trim();
  if (env && !isLocal(env)) return env.replace(/\/+$/, "");

  // Railway injects this automatically (e.g. "data-production-5b03.up.railway.app").
  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || "").trim();
  if (railway) return `https://${railway.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  // The public host the visitor actually used, as passed on by the proxy.
  const fwdHost = req?.headers?.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fwdHost && !isLocal(fwdHost)) {
    const proto = req?.headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${fwdHost}`;
  }
  const host = req?.headers?.get("host")?.trim();
  if (host && !isLocal(host)) return `https://${host}`;

  // Last resort: the request origin (only correct in local dev).
  if (req) {
    try { return new URL(req.url).origin; } catch { /* ignore */ }
  }
  return "http://localhost:3000";
}
