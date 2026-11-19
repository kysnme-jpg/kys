import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getBaseUrl } from "@/lib/base-url";

const req = (headers: Record<string, string>, url = "https://localhost:8080/api/x") => ({
  url,
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
});

describe("getBaseUrl — links in emails must never point at localhost in production", () => {
  const saved = { ...process.env };
  beforeEach(() => { delete process.env.NEXTAUTH_URL; delete process.env.RAILWAY_PUBLIC_DOMAIN; });
  afterEach(() => { process.env = { ...saved }; });

  it("uses NEXTAUTH_URL when it's a real address", () => {
    process.env.NEXTAUTH_URL = "https://shop.example.com/";
    expect(getBaseUrl(req({}))).toBe("https://shop.example.com");
  });
  it("ignores a localhost NEXTAUTH_URL and uses Railway's domain", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.RAILWAY_PUBLIC_DOMAIN = "data-production-5b03.up.railway.app";
    expect(getBaseUrl(req({}))).toBe("https://data-production-5b03.up.railway.app");
  });
  it("with no settings, uses the public host the proxy passed on — not localhost:8080", () => {
    const r = req({ "x-forwarded-host": "data-production-5b03.up.railway.app", "x-forwarded-proto": "https", host: "localhost:8080" });
    expect(getBaseUrl(r)).toBe("https://data-production-5b03.up.railway.app");
  });
  it("only falls back to localhost in local development", () => {
    expect(getBaseUrl(req({ host: "localhost:3000" }, "http://localhost:3000/api/x"))).toBe("http://localhost:3000");
  });
});
