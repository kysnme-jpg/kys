import { Session, check, section, summary, short } from "./lib.mjs";
import fs from "node:fs";

const state = {};
const anon = new Session("anon");
const owner = new Session("owner");

section("First-run setup + staff sign-in");
let r = await anon.post("/api/setup", { storeName: "QA Boutique", email: "owner@qa.test", password: "ownerpass123" });
check("setup creates the store + owner", r.status === 200 || r.status === 201, short(r));
r = await anon.post("/api/setup", { storeName: "Second", email: "x@qa.test", password: "ownerpass123" });
check("setup is locked after the first owner exists", r.status >= 400, short(r));
check("wrong password is rejected", !(await new Session("bad").staffLogin("owner@qa.test", "nope-nope")));
check("owner can sign in", await owner.staffLogin("owner@qa.test", "ownerpass123"));
check("email sign-in is case-insensitive", await new Session("c").staffLogin("OWNER@QA.TEST", "ownerpass123"));

section("Unauthenticated access is refused");
for (const p of ["/api/consignors", "/api/items", "/api/sales", "/api/customers", "/api/payouts", "/api/export/full", "/api/staff/users", "/api/staff/conversations", "/api/internal/channels", "/api/posts", "/api/tags", "/api/me", "/api/notifications", "/api/email-log", "/api/worklogs", "/api/layaways", "/api/borrowed", "/api/insights", "/api/store"]) {
  const a = await anon.get(p);
  check(`anon GET ${p} blocked`, a.status === 401 || a.status === 403 || a.status === 307, short(a));
}

section("Store settings");
r = await owner.get("/api/store");
check("store loads", r.status === 200, short(r));
state.storeTaxBefore = r.json?.taxRate;
r = await owner.patch("/api/store", { taxRate: 0.06 });
if (r.status === 405) r = await owner.put("/api/store", { taxRate: 0.06 });
check("owner can set tax rate (6%)", r.status === 200, short(r));

section("Consignors + items");
r = await owner.post("/api/consignors", { firstName: "Cora", lastName: "Signor", email: "Cora.Signor@QA.test", phone: "555-0100", splitPercent: 50 });
check("create consignor", r.status === 200 || r.status === 201, short(r));
state.consignor = r.json?.consignor || r.json;
const cid = state.consignor?.id;
check("consignor has an id", !!cid);

const mkItem = async (title, price, extra = {}) => {
  const x = await owner.post("/api/items", { title, price, consignorId: cid, type: "CONSIGNED", ...extra });
  return x;
};
r = await mkItem("Silk blouse", 40);
check("create consigned item", r.status === 200 || r.status === 201, short(r));
state.item1 = r.json?.item || r.json;
r = await mkItem("Wool coat", 120, { splitPercent: 60 });
state.item2 = r.json?.item || r.json;
r = await mkItem("Leather bag", 85);
state.item3 = r.json?.item || r.json;
check("items have SKU/barcode", !!(state.item1?.sku || state.item1?.barcode), JSON.stringify(state.item1).slice(0, 200));
r = await owner.post("/api/items", { title: "Store-owned scarf", price: 15, type: "OWNED" });
check("create store-owned item", r.status === 200 || r.status === 201, short(r));
state.itemStore = r.json?.item || r.json;

r = await owner.get(`/api/items?search=${encodeURIComponent(state.item1?.sku || "")}`);
check("item lookup by SKU returns it", r.status === 200 && JSON.stringify(r.json).includes(state.item1?.id || "zzz"), short(r));

section("Customer");
r = await owner.post("/api/customers", { firstName: "Shop", lastName: "Per", email: "shopper@qa.test", phone: "555-0111" });
check("create customer", r.status === 200 || r.status === 201, short(r));
state.customer = r.json?.customer || r.json;

section("Sale → ledger → balance");
r = await owner.post("/api/sales", { items: [{ itemId: state.item1.id, price: 40 }, { itemId: state.item2.id, price: 120 }], paymentMethod: "CASH", discountAmount: 0, pointsRedeemed: 0 });
check("ring up a 2-item sale", r.status === 200 || r.status === 201, short(r));
state.sale = r.json?.sale || r.json;
check("subtotal is 160", state.sale?.subtotal === 160, JSON.stringify(state.sale).slice(0, 200));
check("tax uses store rate 6% → 9.60", Math.abs((state.sale?.taxAmount ?? -1) - 9.6) < 0.001, `tax=${state.sale?.taxAmount}`);
check("total is 169.60", Math.abs((state.sale?.total ?? -1) - 169.6) < 0.001, `total=${state.sale?.total}`);

r = await owner.get(`/api/consignors/${cid}`);
const bal = (r.json?.consignor || r.json)?.balance;
// 40 @50% = 20 ; 120 @60% = 72  → 92
check("consignor balance = 20 + 72 = 92 (per-item split honoured)", Math.abs(bal - 92) < 0.001, `balance=${bal}`);

r = await owner.post("/api/sales", { items: [{ itemId: state.item1.id, price: 40 }], paymentMethod: "CASH" });
check("an already-sold item cannot be sold again", r.status === 400, short(r));

r = await owner.post("/api/sales", { items: [{ itemId: state.item3.id, price: 85 }], paymentMethod: "CASH", customerId: state.customer?.id, discountAmount: 0, pointsRedeemed: 0 });
check("sale WITH a customer attached succeeds", r.status === 200 || r.status === 201, short(r));
r = await owner.get(`/api/customers/${state.customer?.id}`);
const pts = (r.json?.customer || r.json)?.points;
check("customer earned loyalty points (floor of 90.10 = 90)", pts === 90, `points=${pts}`);

section("Loyalty redemption guard");
r = await owner.post("/api/sales", { items: [{ itemId: state.itemStore.id, price: 15 }], paymentMethod: "CASH", customerId: state.customer?.id, discountAmount: 9999, pointsRedeemed: 999999 });
const r2 = await owner.get(`/api/customers/${state.customer?.id}`);
const pts2 = (r2.json?.customer || r2.json)?.points;
check("cannot redeem more points than the customer has / discount beyond subtotal", r.status >= 400 && pts2 >= 0, `status=${r.status} points now=${pts2} total=${(r.json?.sale || r.json)?.total}`);

section("Loyalty redemption (valid)");
r = await owner.post("/api/items", { title: "Points tee", price: 20, type: "OWNED" });
const tee = r.json?.item || r.json;
r = await owner.post("/api/sales", { items: [{ itemId: tee.id, price: 20 }], paymentMethod: "CASH", customerId: state.customer?.id, discountAmount: 0.5, pointsRedeemed: 50 });
check("redeem 50 points on a sale", r.status === 201 || r.status === 200, short(r));
r = await owner.get(`/api/customers/${state.customer?.id}`);
const pts3 = (r.json?.customer || r.json)?.points;
// had 90, −50 redeemed, + floor((20−0.5)*1.06=20.67)=20 earned → 60
check("points = 90 − 50 + 20 = 60", pts3 === 60, `points=${pts3}`);
r = await owner.post("/api/sales", { items: [{ itemId: "nope", price: -5 }] });
check("malformed sale returns a clear 400 (not a server error)", r.status === 400, short(r));
r = await owner.post("/api/items", { title: "Bad", price: 5, type: "NOT_A_TYPE" });
check("malformed item returns a clear 400", r.status === 400, short(r));

section("Refund");
r = await owner.post("/api/refunds", { itemId: state.item2.id, returnTo: "ACTIVE" });
const r0 = r;
check("refund the coat", r.status === 200 || r.status === 201, short(r));
r = await owner.get(`/api/consignors/${cid}`);
const bal2 = (r.json?.consignor || r.json)?.balance;
check("refund reverses the consignor credit (134.50 − 72 = 62.50)", Math.abs(bal2 - 62.5) < 0.001, `balance=${bal2}`);

check("refund tells the cashier what to give back (120 + 6% = 127.20)", Math.abs((r0.json?.refundAmount ?? -1) - 127.2) < 0.001, `refundAmount=${r0.json?.refundAmount}`);
r = await owner.get("/api/insights");
// sales so far: 169.60 + 90.10 + 20.67 = 280.37, minus 127.20 refunded = 153.17
check("Insights revenue is net of the refund (153.17)", Math.abs((r.json?.allTime?.revenue ?? -1) - 153.17) < 0.011, `revenue=${r.json?.allTime?.revenue}`);
r = await owner.post("/api/refunds", { itemId: state.item2.id, returnTo: "ACTIVE" });
check("the same item cannot be refunded twice", r.status === 400, short(r));
// refund the customer's only item → sale fully refunded, points earned on it come back off
r = await owner.post("/api/refunds", { itemId: state.item3.id, returnTo: "RETURNED" });
check("refund a customer's item", r.status === 200 || r.status === 201, short(r));
r = await owner.get(`/api/customers/${state.customer?.id}`);
const pts4 = (r.json?.customer || r.json)?.points;
check("points earned on the refunded sale are taken back (60 − 90 → floor at 0… = 0)", pts4 === 0, `points=${pts4}`);
r = await owner.get(`/api/consignors/${cid}`);
const bal2b = (r.json?.consignor || r.json)?.balance;
check("second refund reverses its credit too (62.50 − 42.50 = 20)", Math.abs(bal2b - 20) < 0.001, `balance=${bal2b}`);
r = await owner.get("/api/sales?limit=25");
check("a fully refunded sale is marked REFUNDED", (r.json?.sales || []).some((x) => x.status === "REFUNDED"), JSON.stringify((r.json?.sales||[]).map(x=>x.status)));

section("Payout");
r = await owner.post("/api/payouts", { consignorId: cid, amount: 500, method: "CASH" });
check("payout over balance is refused", r.status === 400, short(r));
r = await owner.post("/api/payouts", { consignorId: cid, amount: 20, method: "CHECK", checkNumber: "1001" });
check("payout of the full balance", r.status === 200 || r.status === 201, short(r));
r = await owner.get(`/api/consignors/${cid}`);
const bal3 = (r.json?.consignor || r.json)?.balance;
check("balance is 0 after payout", Math.abs(bal3) < 0.001, `balance=${bal3}`);

fs.writeFileSync(new URL("./state.json", import.meta.url), JSON.stringify({ ...state, cid, ownerJar: [...owner.jar] }, null, 1));
summary();
