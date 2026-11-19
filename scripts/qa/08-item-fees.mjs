// Consignor charges on items (dry cleaning, alterations, authentication…).
import { Session, check, section, summary, short } from "./lib.mjs";
import fs from "node:fs";
const state = JSON.parse(fs.readFileSync(new URL("./state.json", import.meta.url)));
const o = new Session("o"); o.jar = new Map(state.ownerJar);
const cid = state.cid;
const bal = async () => ((await o.get(`/api/consignors/${cid}`)).json?.balance);
const near = (a, b) => Math.abs(a - b) < 0.001;
const newItem = async (title, extra = {}) => {
  const r = await o.post("/api/items", { title, price: 100, consignorId: cid, type: "CONSIGNED", splitPercent: 60, ...extra });
  return r.json?.item || r.json;
};
const fees = async (id) => (await o.get(`/api/items/${id}/fees`)).json?.fees || [];
let r, b0, b1;

section("Add charges to an unsold item");
const coat = await newItem("Wool coat (charges)");
b0 = await bal();
r = await o.post(`/api/items/${coat.id}/fees`, { label: "Dry cleaning", amount: 15 });
check("add Dry cleaning $15", r.status === 201 && r.json?.charged === 0, short(r));
r = await o.post(`/api/items/${coat.id}/fees`, { label: "Alterations", amount: 10 });
check("add Alterations $10", r.status === 201, short(r));
check("nothing is deducted before the item sells", near(await bal(), b0));
r = await o.get(`/api/items/${coat.id}`);
check("item details include its charges", r.json?.fees?.length === 2, short(r));

section("Sell it: charges come out of the consignor's share");
r = await o.post("/api/sales", { items: [{ itemId: coat.id, price: 100 }], paymentMethod: "CASH" });
check("sale succeeds", r.status === 201, short(r));
const saleId = r.json?.id;
b1 = await bal();
check("balance goes up 60% of $100 − $25 charges = $35", near(b1 - b0, 35), `before=${b0} after=${b1}`);
r = await o.get(`/api/consignors/${cid}`);
const feeLine = (r.json?.ledgerEntries || []).find((e) => e.type === "FEE_DEBIT" && e.itemId === coat.id);
check("ledger shows one CHARGES line of −$25 on the sale", feeLine && near(feeLine.amount, -25) && feeLine.saleId === saleId, JSON.stringify(feeLine));
check("the line lists what was charged", /Dry cleaning \$15\.00, Alterations \$10\.00/.test(feeLine?.note || ""), feeLine?.note);
check("charges are marked deducted", (await fees(coat.id)).every((f) => f.chargedAt));

section("Refund gives the charges back; they're charged again on the next sale");
r = await o.get(`/api/refunds?code=${encodeURIComponent(coat.sku)}`);
check("refund preview: credit $60, charges $25, net $35", near(r.json?.credit, 60) && near(r.json?.charges, 25) && near(r.json?.reversal, 35), short(r));
r = await o.post("/api/refunds", { itemId: coat.id, returnTo: "ACTIVE" });
check("refund & relist", r.status === 200 && near(r.json?.reversed, 35), short(r));
check("balance is back where it started", near(await bal(), b0), `now=${await bal()} start=${b0}`);
check("charges are waiting again", (await fees(coat.id)).every((f) => !f.chargedAt));
r = await o.post("/api/sales", { items: [{ itemId: coat.id, price: 100 }], paymentMethod: "CARD_CLOVER" });
check("sells again", r.status === 201, short(r));
check("charged again on the second sale (+$35)", near((await bal()) - b0, 35));

section("Change charges on a sold item");
b0 = await bal();
r = await o.post(`/api/items/${coat.id}/fees`, { label: "Authentication", amount: 5 });
check("a charge added after the sale comes off right away", r.status === 201 && near(r.json?.charged, 5) && near(await bal(), b0 - 5), short(r));
const auth = r.json?.fee;
r = await o.del(`/api/items/${coat.id}/fees/${auth.id}`);
check("removing a deducted charge puts it back", r.status === 200 && near(r.json?.returned, 5) && near(await bal(), b0), short(r));

section("Manual 'sold' status and bulk mark sold");
const bag = await newItem("Handbag (manual sold)");
await o.post(`/api/items/${bag.id}/fees`, { label: "Repair", amount: 20 });
b0 = await bal();
r = await o.patch(`/api/items/${bag.id}`, { status: "SOLD" });
check("marking sold credits $60 and deducts $20", r.status === 200 && near((await bal()) - b0, 40), `delta=${(await bal()) - b0}`);
r = await o.patch(`/api/items/${bag.id}`, { status: "ACTIVE" });
check("undoing it reverses both", near(await bal(), b0), `delta=${(await bal()) - b0}`);
const scarf = await newItem("Scarf (bulk sold)");
await o.post(`/api/items/${scarf.id}/fees`, { label: "Dry cleaning", amount: 8 });
b0 = await bal();
r = await o.post("/api/items/bulk", { action: "markSold", ids: [scarf.id] });
check("bulk mark sold deducts the charge", r.status === 200 && near((await bal()) - b0, 52), `delta=${(await bal()) - b0}`);

section("Split into pieces shares the charges");
const set = await newItem("Bracelet set (charges)");
await o.post(`/api/items/${set.id}/fees`, { label: "Authentication", amount: 10 });
r = await o.post(`/api/items/${set.id}/split`, { pieces: 3, priceEach: 30 });
check("split succeeds", r.status === 201, short(r));
const pf = await Promise.all((r.json?.pieces || []).map((p) => fees(p.id)));
check("$10 is shared $3.34 / $3.33 / $3.33", pf.map((f) => f[0]?.amount).join(",") === "3.34,3.33,3.33", JSON.stringify(pf));

section("Rules");
const owned = (await o.post("/api/items", { title: "Store-owned item", price: 20, type: "OWNED" })).json;
r = await o.post(`/api/items/${owned.id}/fees`, { label: "Dry cleaning", amount: 5 });
check("store-owned items can't have consignor charges", r.status === 400, short(r));
r = await o.post(`/api/items/${bag.id}/fees`, { label: "Repair", amount: 0 });
check("rejects a $0 charge", r.status === 400, short(r));
r = await o.post(`/api/items/${bag.id}/fees`, { label: "  ", amount: 5 });
check("rejects a charge with no description", r.status === 400, short(r));
r = await new Session("anon").post(`/api/items/${bag.id}/fees`, { label: "Repair", amount: 5 });
check("requires a staff sign-in", [401, 307].includes(r.status), short(r));
summary();
