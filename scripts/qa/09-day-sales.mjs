// "Sold today" list on the POS: every item sold on a day, with its consignor.
import { Session, check, section, summary, short } from "./lib.mjs";
import fs from "node:fs";
const state = JSON.parse(fs.readFileSync(new URL("./state.json", import.meta.url)));
const o = new Session("o"); o.jar = new Map(state.ownerJar);
const cid = state.cid;
const mk = async (title, extra = {}) => {
  const r = await o.post("/api/items", { title, price: 40, consignorId: cid, type: "CONSIGNED", splitPercent: 50, ...extra });
  return r.json?.item || r.json;
};
let r;

section("Today's list");
r = await o.get("/api/sales/day");
check("loads for today", r.status === 200 && r.json?.date === r.json?.today, short(r));
const before = r.json;
const consignorName = (await o.get(`/api/consignors/${cid}`)).json;
const name = `${consignorName.firstName} ${consignorName.lastName}`;

const a = await mk("Day-list silk blouse");
const b = await mk("Day-list leather belt");
const c = await mk("Day-list hand-marked scarf");
const own = (await o.post("/api/items", { title: "Day-list store candle", price: 12, type: "OWNED" })).json;
r = await o.post("/api/sales", { items: [{ itemId: a.id, price: 40 }, { itemId: own.id, price: 12 }], paymentMethod: "CASH" });
check("a cash sale of 2 items", r.status === 201, short(r));
r = await o.post("/api/sales", { items: [{ itemId: b.id, price: 40 }], paymentMethod: "CARD_CLOVER" });
check("a card sale", r.status === 201, short(r));
await o.patch(`/api/items/${c.id}`, { status: "SOLD" });

r = await o.get("/api/sales/day");
const rows = r.json?.rows || [];
const row = (id) => rows.find((x) => x.itemId === id);
check("register sales appear with the consignor's name", row(a.id)?.consignor === name && row(b.id)?.consignor === name, JSON.stringify(row(a.id)));
check("payment shows Cash / Card", row(a.id)?.how === "Cash" && row(b.id)?.how === "Card");
check("an item marked sold by hand appears too", row(c.id)?.how === "Marked sold" && row(c.id)?.consignor === name, JSON.stringify(row(c.id)));
check("a store-owned item is labelled store-owned", row(own.id)?.storeOwned === true && row(own.id)?.consignor === null);
check("newest first", rows.indexOf(row(c.id)) < rows.indexOf(row(a.id)));
check("count and total go up by 4 items / $132", r.json.count - before.count === 4 && Math.abs(r.json.total - before.total - 132) < 0.001, `count ${before.count}→${r.json.count}, total ${before.total}→${r.json.total}`);

section("Refunds stay listed, marked refunded");
await o.post("/api/refunds", { itemId: b.id, returnTo: "ACTIVE" });
r = await o.get("/api/sales/day");
const rb = (r.json?.rows || []).find((x) => x.itemId === b.id);
check("the refunded line is still there, flagged", rb?.refunded === true, JSON.stringify(rb));
check("and no longer counts toward the day", r.json.count - before.count === 3 && Math.abs(r.json.total - before.total - 92) < 0.001);

section("Other days");
const today = r.json.today;
const [y, m, d] = today.split("-").map(Number);
const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
r = await o.get(`/api/sales/day?date=${yesterday}`);
check("yesterday's list doesn't include today's sales", r.status === 200 && r.json.date === yesterday && !(r.json.rows || []).some((x) => x.itemId === a.id), short(r));
r = await o.get("/api/sales/day?date=2026-02-30");
check("a bad date falls back to today", r.json?.date === today);
r = await new Session("anon").get("/api/sales/day");
check("requires a staff sign-in", [401, 307].includes(r.status), short(r));
summary();
