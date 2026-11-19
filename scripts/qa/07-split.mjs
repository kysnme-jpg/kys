// Split an item into separately-sold pieces.
import { Session, check, section, summary, short } from "./lib.mjs";
import fs from "node:fs";
const state = JSON.parse(fs.readFileSync(new URL("./state.json", import.meta.url)));
const o = new Session("o"); o.jar = new Map(state.ownerJar);
const cid = state.cid;
const bal = async () => ((await o.get(`/api/consignors/${cid}`)).json?.balance);
let r;

section("Split a jewelry set into 5 pieces");
r = await o.post("/api/items", { title: "Various jewelry set", price: 125, costPrice: 50, consignorId: cid, type: "CONSIGNED", splitPercent: 60, brand: "Assorted", condition: "Good" });
const set = r.json?.item || r.json;
r = await o.post(`/api/items/${set.id}/split`, { pieces: 5, priceEach: 25, title: "Jewelry piece" });
check("split succeeds", r.status === 201 && r.json?.pieces?.length === 5, short(r));
const pieces = r.json?.pieces || [];
check("each piece is $25", pieces.every((p) => p.price === 25));
check("pieces are named 1 of 5 … 5 of 5", pieces.map((p) => p.title).join("|") === [1, 2, 3, 4, 5].map((i) => `Jewelry piece — ${i} of 5`).join("|"));
check("every piece has its own SKU", new Set(pieces.map((p) => p.sku)).size === 5);
r = await o.get(`/api/items/${set.id}`);
check("the original set is gone", r.status === 404, short(r));
const full = await Promise.all(pieces.map((p) => o.get(`/api/items/${p.id}`).then((x) => x.json)));
check("pieces keep consignor, split % and brand", full.every((p) => p.consignorId === cid && p.splitPercent === 60 && p.brand === "Assorted"), JSON.stringify(full[0]).slice(0, 200));
check("cost is shared out ($50 / 5 = $10 each)", full.every((p) => p.costPrice === 10));

section("Sell one piece");
const before = await bal();
r = await o.post("/api/sales", { items: [{ itemId: pieces[0].id, price: 25 }], paymentMethod: "CASH" });
check("one piece sells at the POS", r.status === 201 || r.status === 200, short(r));
const after = await bal();
check("consignor is credited 60% of $25 = $15", Math.abs(after - before - 15) < 0.001, `before=${before} after=${after}`);
r = await o.get(`/api/consignors/${cid}`);
const items = r.json?.items || [];
check("consignor page shows 1 piece sold and 4 still active", items.filter((i) => i.title.startsWith("Jewelry piece") && i.status === "SOLD").length === 1 && items.filter((i) => i.title.startsWith("Jewelry piece") && i.status === "ACTIVE").length === 4);

section("Safety rules");
r = await o.post(`/api/items/${pieces[0].id}/split`, { pieces: 2, priceEach: 10 });
check("a sold item can't be split", r.status === 400, short(r));
r = await o.post("/api/refunds", { itemId: pieces[0].id, returnTo: "ACTIVE" });
r = await o.post(`/api/items/${pieces[0].id}/split`, { pieces: 2, priceEach: 10 });
check("an item with sales history can't be split (even after a refund)", r.status === 400 && /sales history/.test(r.json?.error || ""), short(r));
for (const [body, why] of [[{ pieces: 1, priceEach: 10 }, "1 piece"], [{ pieces: 51, priceEach: 1 }, "51 pieces"], [{ pieces: 3, priceEach: 0 }, "$0 price"]]) {
  r = await o.post(`/api/items/${pieces[1].id}/split`, body);
  check(`rejects ${why}`, r.status === 400, short(r));
}
r = await o.post("/api/items/no-such-item/split", { pieces: 2, priceEach: 5 });
check("unknown item → 404", r.status === 404, short(r));
r = await new Session("anon").post(`/api/items/${pieces[1].id}/split`, { pieces: 2, priceEach: 5 });
check("requires a staff sign-in", [401, 307].includes(r.status), short(r));
summary();
