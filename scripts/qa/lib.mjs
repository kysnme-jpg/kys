// Minimal QA harness: cookie-jar sessions against the locally running app.
export const BASE = process.env.QA_BASE_URL || "http://localhost:3055";

export class Session {
  constructor(name) { this.name = name; this.jar = new Map(); this.bearer = null; }
  cookieHeader() { return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
  absorb(res) {
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
      if (v === "" || /Max-Age=0/i.test(c)) this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  async req(method, path, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (this.jar.size) headers.cookie = this.cookieHeader();
    if (this.bearer) headers.authorization = `Bearer ${this.bearer}`;
    let payload;
    if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    this.absorb(res);
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
  get(p, h) { return this.req("GET", p, undefined, h); }
  post(p, b, h) { return this.req("POST", p, b ?? {}, h); }
  patch(p, b) { return this.req("PATCH", p, b ?? {}); }
  put(p, b) { return this.req("PUT", p, b ?? {}); }
  del(p) { return this.req("DELETE", p); }

  // NextAuth credentials sign-in.
  async staffLogin(email, password) {
    const csrf = await this.get("/api/auth/csrf");
    const form = new URLSearchParams({ csrfToken: csrf.json.csrfToken, email, password, callbackUrl: BASE + "/home", json: "true" });
    const res = await fetch(BASE + "/api/auth/callback/credentials", {
      method: "POST", redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: this.cookieHeader() },
      body: form.toString(),
    });
    this.absorb(res);
    const s = await this.get("/api/auth/session");
    return !!s.json?.user;
  }
}

let pass = 0, fail = 0; const failures = [];
export function check(label, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; failures.push(label + (detail ? ` — ${detail}` : "")); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); }
}
export function section(t) { console.log(`\n## ${t}`); }
export function summary() { console.log(`\n==== ${pass} passed, ${fail} failed ====`); for (const f of failures) console.log("  ✗ " + f); }
export const short = (r) => `${r.status} ${(r.text || "").slice(0, 160)}`;
