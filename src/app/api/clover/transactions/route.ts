import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCloverClient } from "@/lib/clover";

// Staff: pull recent Clover card transactions for the dashboard.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = (session.user as any).storeId;

  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") || "30")));
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const store = await db.store.findUnique({ where: { id: storeId }, select: { cloverApiKey: true, cloverMerchantId: true } });

  // Config snapshot for diagnostics (no secrets).
  const baseUrl = process.env.CLOVER_API_BASE || "https://api.clover.com";
  const merchantId = store?.cloverMerchantId || process.env.CLOVER_MERCHANT_ID || "";
  const diag = {
    base: baseUrl,
    isSandbox: /sandbox|dev\.clover/i.test(baseUrl),
    merchantIdMask: merchantId ? `${merchantId.slice(0, 4)}…${merchantId.slice(-3)} (${merchantId.length} chars)` : "(not set)",
    keySource: store?.cloverApiKey ? "Settings" : (process.env.CLOVER_API_KEY ? "env var" : "(not set)"),
  };

  let client;
  try {
    client = getCloverClient(store || undefined);
  } catch {
    return NextResponse.json({ configured: false, error: "Clover isn't connected yet. Add your Clover API token and Merchant ID in Settings.", diag }, { status: 200 });
  }

  let payments: any[];
  try {
    payments = await client.listPayments(sinceMs);
  } catch (err: any) {
    const msg = String(err?.message || "");
    const code = /error (\d{3})/.exec(msg)?.[1];
    let friendly = "Couldn't reach Clover.";
    if (code === "401") friendly = "Clover returned 401 (Unauthorized) — the token isn't valid for this environment/merchant. Most often the app is pointed at the wrong Clover environment (sandbox vs. production) or the token is from a different merchant.";
    else if (code === "403") friendly = "Clover returned 403 (Forbidden) — the token is valid but lacks 'Payments: Read' permission. Add it in Clover → Setup → API Tokens.";
    return NextResponse.json({ configured: true, ok: false, status: code || null, error: friendly, detail: msg.slice(0, 400), diag }, { status: 200 });
  }

  // Aggregate. Clover amounts are in cents; skip voided/declined where possible.
  const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD local
  const todayKey = dayKey(Date.now());

  let total = 0, count = 0, todayTotal = 0, todayCount = 0;
  const perDay: Record<string, { total: number; count: number }> = {};
  const recent: any[] = [];

  for (const p of payments) {
    const amt = (p.amount || 0) / 100;
    const ms = p.createdTime || 0;
    // Clover payment result can be SUCCESS; ignore obvious failures if present.
    if (p.result && !["SUCCESS", "APPROVED", "AUTH"].includes(String(p.result).toUpperCase())) continue;
    total += amt; count++;
    const k = dayKey(ms);
    (perDay[k] ||= { total: 0, count: 0 });
    perDay[k].total += amt; perDay[k].count++;
    if (k === todayKey) { todayTotal += amt; todayCount++; }
    if (recent.length < 20) recent.push({ id: p.id, amount: amt, createdTime: ms, tender: p.tender?.label || p.cardTransaction?.cardType || "Card" });
  }

  const daily = Object.keys(perDay).sort().map((d) => ({ date: d, total: parseFloat(perDay[d].total.toFixed(2)), count: perDay[d].count }));

  return NextResponse.json({
    configured: true, ok: true, days,
    total: parseFloat(total.toFixed(2)), count,
    todayTotal: parseFloat(todayTotal.toFixed(2)), todayCount,
    daily, recent,
  });
}
