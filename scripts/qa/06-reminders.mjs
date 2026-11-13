// Reminder rules end to end. Needs the app started with EMAIL_DRY_RUN=1 and
// CRON_SECRET=qa-cron, and psql access to the scratch database (QA_PSQL).
import { Session, check, section, summary, short } from "./lib.mjs";
import fs from "node:fs";
import { execSync } from "node:child_process";

const PSQL = process.env.QA_PSQL || "psql -h 127.0.0.1 -p 55440 -U postgres -d qa";
const sql = (q) => execSync(`${PSQL} -At -c ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();
const state = JSON.parse(fs.readFileSync(new URL("./state.json", import.meta.url)));
const owner = new Session("owner"); owner.jar = new Map(state.ownerJar);
const cron = () => fetch((process.env.QA_BASE_URL || "http://localhost:3055") + "/api/cron/reminders", { method: "POST", headers: { authorization: "Bearer qa-cron" } }).then((r) => r.json());
const logs = async (type) => ((await owner.get(`/api/email-log?type=${type}`)).json?.logs || []);
let r;

// Make "now" daytime for the store so the automatic run is allowed to send.
const utcHour = new Date().getUTCHours();
const offset = 12 - utcHour; // hours to add to reach noon
sql(`UPDATE "Store" SET timezone = 'Etc/GMT${offset >= 0 ? "-" : "+"}${Math.abs(offset)}'`);

const mkLay = async (name, daysAgo, extra = {}) => {
  const x = await owner.post("/api/layaways", { buyerName: name, email: `${name.toLowerCase()}@qa.test`, items: "Dress", totalPrice: 200, deposit: 50, payment2: 50, payment3: 50, finalPayment: 50, ...extra });
  const id = (x.json?.layaway || x.json)?.id;
  sql(`UPDATE "Layaway" SET "startDate" = NOW() - INTERVAL '${daysAgo} days', "amountPaid" = ${extra.paid ?? 50} WHERE id = '${id}'`);
  return id;
};
const mkBor = async (name, daysAgo, extra = {}) => {
  const x = await owner.post("/api/borrowed", { borrowerName: name, email: `${name.toLowerCase()}@qa.test`, items: "Gown", ...extra });
  const id = (x.json?.borrowed || x.json?.garment || x.json)?.id;
  sql(`UPDATE "BorrowedGarment" SET "dateBorrowed" = NOW() - INTERVAL '${daysAgo} days' WHERE id = '${id}'`);
  return id;
};

section("Layaway — a reminder every 2 weeks until paid");
const lNew = await mkLay("LayNew", 5);          // not 14 days yet
const lDue = await mkLay("LayDue", 15);         // 1 period
const lLate = await mkLay("LayLate", 44);       // 3 periods, never reminded → ONE catch-up email
const lPaid = await mkLay("LayPaid", 30, { paid: 200 });
const lNoEmail = (await owner.post("/api/layaways", { buyerName: "LayNoEmail", items: "x", totalPrice: 100 })).json;
check("test layaways created", !!lNew && !!lDue && !!lLate && !!lPaid, "ids missing");
r = await cron();
check("automatic run completes", r.ok === true, JSON.stringify(r));
let L = await logs("LAYAWAY");
const sentTo = (rows, who) => rows.filter((l) => l.to === `${who.toLowerCase()}@qa.test` && l.status === "SENT").length;
check("no reminder before 14 days", sentTo(L, "LayNew") === 0);
check("reminder at 14+ days", sentTo(L, "LayDue") === 1, `count=${sentTo(L, "LayDue")}`);
check("a long-overdue layaway gets ONE reminder, not a backlog", sentTo(L, "LayLate") === 1, `count=${sentTo(L, "LayLate")}`);
check("a paid-off layaway gets no reminder", sentTo(L, "LayPaid") === 0);
r = await cron(); r = await cron();
L = await logs("LAYAWAY");
check("running again sends nothing new (no duplicates)", sentTo(L, "LayDue") === 1 && sentTo(L, "LayLate") === 1, `due=${sentTo(L, "LayDue")} late=${sentTo(L, "LayLate")}`);
sql(`UPDATE "Layaway" SET "startDate" = "startDate" - INTERVAL '14 days' WHERE id = '${lDue}'`);
await cron(); L = await logs("LAYAWAY");
check("two weeks later it reminds again", sentTo(L, "LayDue") === 2, `count=${sentTo(L, "LayDue")}`);
sql(`UPDATE "Layaway" SET "startDate" = "startDate" - INTERVAL '14 days', "amountPaid" = 200, status = 'COMPLETED' WHERE id = '${lDue}'`);
await cron(); L = await logs("LAYAWAY");
check("and stops once it is paid", sentTo(L, "LayDue") === 2, `count=${sentTo(L, "LayDue")}`);

section("Layaway — manual Send reminder");
r = await owner.post(`/api/layaways/${lNew}/remind`);
check("manual reminder sends any time", r.status === 200 && r.json?.to === "laynew@qa.test", short(r));
r = await owner.post(`/api/layaways/${lPaid}/remind`);
check("manual reminder refused when fully paid", r.status === 400, short(r));
r = await owner.post(`/api/layaways/${lNoEmail?.layaway?.id || lNoEmail?.id}/remind`);
check("manual reminder explains a missing email", r.status === 400 && /email/i.test(r.json?.error || ""), short(r));
await cron(); L = await logs("LAYAWAY");
check("a manual reminder does not disturb the 2-week schedule", sentTo(L, "LayNew") === 1, `count=${sentTo(L, "LayNew")}`);
r = await owner.get("/api/layaways");
const rowNew = (r.json?.layaways || r.json || []).find?.((x) => x.id === lNew);
check("the page data shows when it was last reminded", !!rowNew?.lastReminderAt, JSON.stringify(rowNew || {}).slice(0, 160));

section("Borrowed — a reminder 3 days after borrowing");
const bNew = await mkBor("BorNew", 1);
const bDue = await mkBor("BorDue", 4);
const bBack = await mkBor("BorBack", 6);
sql(`UPDATE "BorrowedGarment" SET status = 'RETURNED' WHERE id = '${bBack}'`);
check("test agreements created", !!bNew && !!bDue && !!bBack, "ids missing");
await cron();
let B = await logs("BORROWED");
check("no reminder before 3 days", sentTo(B, "BorNew") === 0);
check("reminder once 3 days have passed", sentTo(B, "BorDue") === 1, `count=${sentTo(B, "BorDue")}`);
check("no reminder for items already returned", sentTo(B, "BorBack") === 0);
await cron(); await cron(); B = await logs("BORROWED");
check("the 3-day reminder is sent only once", sentTo(B, "BorDue") === 1, `count=${sentTo(B, "BorDue")}`);
sql(`UPDATE "BorrowedGarment" SET "dateBorrowed" = NOW() - INTERVAL '3 days 1 hour' WHERE id = '${bNew}'`);
await cron(); B = await logs("BORROWED");
check("it fires when the 3 days are up", sentTo(B, "BorNew") === 1, `count=${sentTo(B, "BorNew")}`);

section("Borrowed — manual Send reminder");
r = await owner.post(`/api/borrowed/${bDue}/remind`);
check("manual reminder sends any time", r.status === 200 && r.json?.to === "bordue@qa.test", short(r));
r = await owner.post(`/api/borrowed/${bBack}/remind`);
check("manual reminder refused once returned", r.status === 400, short(r));

section("Quiet hours");
sql(`UPDATE "Store" SET timezone = 'Etc/GMT${offset >= 0 ? "+" : "-"}${Math.abs(12 - Math.abs(offset)) || 12}'`);
const nightHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: sql(`SELECT timezone FROM "Store" LIMIT 1`) }).format(new Date()));
const lNight = await mkLay("LayNight", 15);
await cron(); L = await logs("LAYAWAY");
if (nightHour < 8 || nightHour >= 20) check("automatic reminders wait for daytime", sentTo(L, "LayNight") === 0, `count=${sentTo(L, "LayNight")}`);
else console.log("  (skipped: could not simulate night for this hour)");
r = await owner.post(`/api/layaways/${lNight}/remind`);
check("manual reminders are allowed at any hour", r.status === 200, short(r));

summary();
