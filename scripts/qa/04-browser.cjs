const { chromium, devices } = require("playwright");
const BASE = process.env.QA_BASE_URL || "http://localhost:3055";
(async () => {
  const browser = await chromium.launch();
  let pass = 0, fail = 0; const out = [];
  const check = (l, c, d = "") => { c ? pass++ : fail++; if (!c) out.push(`FAIL ${l} ${d}`); };

  // 1) A consignor on a phone with NO staff session opens the emailed link.
  const phone = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await phone.newPage();
  await p.goto(BASE + "/portal/login");
  check("phone: emailed portal link shows the Consignor Portal login (not staff)", (await p.textContent("body")).includes("Consignor Portal"), p.url());
  await p.fill('input[type="email"]', "Cora.Signor@qa.test");
  await p.fill('input[type="password"]', "MyOwnPass99");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/portal$/, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const body = await p.textContent("body");
  check("phone: consignor lands in their portal", /Cora/.test(body) && /Available balance/i.test(body), p.url());
  await p.click("text=Messages"); await p.waitForTimeout(600);
  await p.fill("textarea", "Browser test message"); await p.click("textarea ~ button"); await p.waitForTimeout(900);
  check("phone: sent message appears as a bubble", (await p.textContent("body")).includes("Browser test message"));
  await p.click("text=Updates"); await p.waitForTimeout(900);
  check("phone: Updates tab shows consignor posts", /P-consignors|P-everyone/.test(await p.textContent("body")));
  await p.screenshot({ path: "portal-phone.png" });
  await p.goto(BASE + "/login");
  check("staff login offers the consignor link", (await p.textContent("body")).includes("Are you a consignor?"));

  // 2) Staff desktop: sign in through the UI, visit every page, collect errors.
  const desk = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const d = await desk.newPage();
  const errors = [];
  d.on("pageerror", (e) => errors.push(`[pageerror] ${d.url()} ${e.message}`));
  d.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) errors.push(`[console] ${d.url()} ${m.text().slice(0, 160)}`); });
  d.on("response", (r) => { if (r.status() >= 500) errors.push(`[5xx] ${r.status()} ${r.url()}`); });
  await d.goto(BASE + "/login");
  await d.fill('input[type="email"]', "owner@qa.test");
  await d.fill('input[type="password"]', "ownerpass123");
  await d.click('button[type="submit"]');
  await d.waitForURL(/\/home/, { timeout: 8000 }).catch(() => {});
  await d.waitForTimeout(1000);
  check("staff: lands on Home with a greeting", /Good (morning|afternoon|evening)/.test(await d.textContent("body")), d.url());
  const pages = ["/pos", "/inventory", "/inventory/new", "/inventory/intake", "/consignors", "/consignors/new", "/customers", "/appointments", "/layaway", "/borrowed", "/sip-shop", "/payouts", "/contracts", "/admin", "/insights", "/reports", "/import", "/settings", "/settings/staff", "/settings/notifications", "/messages", "/team", "/announcements", "/content", "/email", "/tags", "/home"];
  for (const path of pages) {
    const before = errors.length;
    const resp = await d.goto(BASE + path, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => null);
    await d.waitForTimeout(300);
    const txt = (await d.textContent("body").catch(() => "")) || "";
    check(`staff page ${path} renders without errors`, !!resp && resp.status() === 200 && errors.length === before && !/Application error|Unhandled Runtime Error/.test(txt), `${resp && resp.status()} ${errors.slice(before).join(" | ")}`);
  }
  await d.goto(BASE + "/pos", { waitUntil: "networkidle" });
  check("POS shows the store's saved tax rate (6%)", /Tax \(6%\)/.test(await d.textContent("body")), ((await d.textContent("body")).match(/Tax \([^)]*\)/) || [""])[0]);
  await d.screenshot({ path: "pos.png" });
  await d.goto(BASE + "/payouts", { waitUntil: "networkidle" });
  await d.goto(BASE + "/consignors", { waitUntil: "networkidle" });
  const link = await d.$('a[href^="/consignors/c"]');
  if (link) { await link.click(); await d.waitForTimeout(1500); check("consignor detail shows Preview portal + tags", /Preview portal/.test(await d.textContent("body")) ); }
  console.log(`==== browser: ${pass} passed, ${fail} failed ====`); out.forEach((o) => console.log("  " + o));
  await browser.close();
})();
