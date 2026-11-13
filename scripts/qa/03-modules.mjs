import { Session, check, section, summary, short } from "./lib.mjs";
import fs from "node:fs";

const state = JSON.parse(fs.readFileSync(new URL("./state.json", import.meta.url)));
const owner = new Session("owner"); owner.jar = new Map(state.ownerJar);
const anon = new Session("anon");
const cid = state.cid;
let r;
const ok = (x) => x.status >= 200 && x.status < 300;
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

section("Public pages reachable without any login");
for (const p of ["/portal/login", "/portal", "/book", "/shop", "/welcome", "/sip-and-shop", "/dealer", "/login", "/setup"]) {
  const x = await anon.get(p);
  check(`public page ${p} loads (not bounced to staff login)`, x.status === 200 || (x.status === 307 && !/\/login$/.test(x.headers.get("location") || "") ) || p === "/login", `${x.status} → ${x.headers.get("location") || ""}`);
}
for (const p of ["/home", "/pos", "/inventory", "/consignors", "/customers", "/payouts", "/insights", "/reports", "/settings", "/settings/staff", "/messages", "/team", "/content", "/email", "/tags", "/admin", "/import", "/announcements"]) {
  const x = await anon.get(p);
  check(`staff page ${p} requires login`, x.status === 307, `${x.status}`);
  const y = await owner.get(p);
  check(`staff page ${p} renders for the owner`, y.status === 200, `${y.status}`);
}

section("Public booking (appointments)");
r = await anon.get("/api/book");
check("public availability loads", r.status === 200, short(r));
// find a bookable weekday a week or more out
let booked = null, lastErr = "";
for (let n = 7; n < 21 && !booked; n++) {
  const x = await anon.post("/api/book", { date: day(n), slot: 0, name: "Walk In", email: "walkin@qa.test", phone: "555-0199" });
  if (ok(x)) booked = { n, x }; else lastErr = short(x);
}
check("a visitor can book an appointment", !!booked, lastErr);
if (booked) {
  const again = await anon.post("/api/book", { date: day(booked.n), slot: 0, name: "Dupe", email: "d@qa.test" });
  check("the same slot cannot be double-booked", again.status >= 400, short(again));
}
r = await owner.get("/api/appointments");
check("staff see the booking", r.status === 200 && JSON.stringify(r.json).includes("Walk In"), short(r));
r = await anon.post("/api/book", { date: "not-a-date", slot: 0, name: "x" });
check("bad booking input → 400 not 500", r.status === 400, short(r));

section("Kiosk check-in");
r = await anon.post("/api/checkin", { firstName: "Kiosk", lastName: "Guest", email: "kiosk@qa.test", birthday: "03-14" });
check("kiosk sign-in creates a customer", ok(r), short(r));
r = await anon.post("/api/checkin", { firstName: "Kiosk", lastName: "Guest", email: "KIOSK@qa.test" });
r = await owner.get("/api/customers");
const kioskCount = (r.json?.customers || []).filter((c) => (c.email || "").toLowerCase() === "kiosk@qa.test").length;
check("kiosk sign-in twice does not duplicate the customer", kioskCount === 1, `count=${kioskCount}`);

section("Sip & Shop");
r = await anon.post("/api/sip-and-shop", { hostName: "Party Host", email: "host@qa.test", guests: 8, eventDate: day(20) });
check("public Sip & Shop request", ok(r), short(r));
r = await owner.get("/api/sipshop");
check("staff see the event request", JSON.stringify(r.json).includes("Party Host"), short(r));

section("Layaway");
r = await owner.post("/api/layaways", { buyerName: "Lay Away", email: "lay@qa.test", items: "Red dress", totalPrice: 200, serviceFee: 5, deposit: 50, payment2: 50, payment3: 50, finalPayment: 55 });
check("create layaway", ok(r), short(r));
const lay = r.json?.layaway || r.json;
r = await owner.post("/api/layaways", { buyerName: "", items: "" });
check("invalid layaway → 400 with message", r.status === 400 && !!r.json?.error, short(r));
r = await owner.get("/api/layaways");
check("layaway listed", JSON.stringify(r.json).includes("Lay Away"), short(r));

section("Borrowed garments");
r = await owner.post("/api/borrowed", { borrowerName: "Bo Rower", email: "bo@qa.test", items: "Gown", returnDate: day(5), dryCleaning: "BORROWER" });
check("create borrowed agreement", ok(r), short(r));
r = await owner.get("/api/borrowed");
check("borrowed listed", JSON.stringify(r.json).includes("Bo Rower"), short(r));

section("Time card");
r = await owner.post("/api/worklogs", { employeeName: "Emma", date: day(0), hours: 6.5, payout: 97.5 });
check("add time card entry", ok(r), short(r));
r = await owner.get("/api/worklogs");
check("time card entry listed", JSON.stringify(r.json).includes("Emma"), short(r));

section("Contracts + e-sign");
r = await owner.post("/api/contracts", { consignorId: cid, sendEmail: false });
check("create a contract", ok(r), short(r));
const contract = r.json?.contract || r.json;
r = await anon.get(`/portal/sign/${contract?.id}`);
check("signing page is reachable without login", r.status === 200, `${r.status}`);
check("signing page does not expose a password hash", !/\$2[aby]\$\d\d\$/.test(r.text), "hash in page");
r = await anon.post(`/api/contracts/${contract?.id}/sign`, { signatureData: "data:image/png;base64,AAAA" });
check("consignor can sign", ok(r), short(r));
r = await anon.post(`/api/contracts/${contract?.id}/sign`, { signatureData: "data:image/png;base64,BBBB" });
check("a signed contract cannot be re-signed", r.status === 409, short(r));

section("Bulk actions + reconcile");
r = await owner.post("/api/consignors/bulk", { action: "setSplit", ids: [cid], value: "55" });
check("bulk set split", ok(r), short(r));
r = await owner.post("/api/consignors/reconcile");
check("reconcile balances runs", ok(r), short(r));
r = await owner.post("/api/customers/bulk", { action: "addPoints", ids: [state.customer?.id], value: "10" });
check("bulk add points", ok(r), short(r));

section("Reports / insights / shop / email log");
for (const p of ["/api/insights", "/api/email-log", "/api/shop/items", "/api/categories", "/api/sales", "/api/discount-rules"]) {
  const x = await owner.get(p);
  check(`GET ${p}`, x.status === 200, short(x));
}
r = await owner.get("/api/insights");
fs.writeFileSync(new URL("./insights.json", import.meta.url), JSON.stringify(r.json, null, 1));
r = await anon.get("/api/shop/items");
check("public shop lists only items flagged for online", r.status === 200 && (r.json?.items || []).length === 0, short(r));
check("public shop feed has no consignor/cost data", !/costPrice|consignorId|splitPercent/.test(r.text), r.text.slice(0, 200));

section("Cross-store / id tampering");
r = await owner.get("/api/consignors/does-not-exist");
check("unknown consignor → 404", r.status === 404, short(r));
r = await owner.post("/api/refunds", { itemId: "nope" });
check("refund unknown item → 404", r.status === 404, short(r));
r = await owner.post("/api/payouts", { consignorId: "nope", amount: 5, method: "CASH" });
check("payout unknown consignor → 404", r.status === 404, short(r));

section("Cron endpoint");
r = await anon.post("/api/cron/reminders");
check("cron is disabled/denied without its secret", r.status === 401 || r.status === 403 || r.status === 503, short(r));

summary();
