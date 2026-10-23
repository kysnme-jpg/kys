"use client";

import { useState, useEffect, useCallback } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, ShoppingBag, Package, DollarSign,
  RotateCcw, CheckCircle, ArrowUpRight, RefreshCw
} from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

interface Insights {
  allTime: { revenue: number; transactions: number };
  last30Days: { revenue: number; transactions: number };
  inventory: { active: number; sold: number; returned: number; total: number; sellThroughRate: number };
  payouts: { totalPaid: number; count: number };
  revenueByDay: { date: string; revenue: number }[];
  topCategories: { name: string; sold: number }[];
}

function StatCard({
  label, value, sub, icon: Icon, trend, color = "indigo",
}: {
  label: string; value: string; sub?: string; icon: any; trend?: number; color?: string;
}) {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "text-indigo-500" },
    green:  { bg: "bg-green-50",  text: "text-green-700",  icon: "text-green-500" },
    purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-500" },
    orange: { bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-500" },
    blue:   { bg: "bg-blue-50",   text: "text-blue-700",   icon: "text-blue-500" },
  };
  const c = colors[color] || colors.indigo;
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                <ArrowUpRight className={`h-3.5 w-3.5 ${trend >= 0 ? "text-green-500" : "text-red-500 rotate-180"}`} />
                <span className={`text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {Math.abs(trend)}% vs last period
                </span>
              </div>
            )}
          </div>
          <div className={`h-11 w-11 ${c.bg} rounded-xl flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${c.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [clover, setClover] = useState<any>(null);
  const [cloverAt, setCloverAt] = useState<string>("");
  const [cloverLoading, setCloverLoading] = useState(false);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  // Pull Clover transactions (on demand + on a loop).
  const loadClover = useCallback(async () => {
    setCloverLoading(true);
    try {
      const r = await fetch("/api/clover/transactions?days=30", { cache: "no-store" });
      const d = await r.json();
      setClover(d); setCloverAt(new Date().toLocaleTimeString());
    } catch { /* ignore */ } finally {
      setCloverLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClover();
    const t = setInterval(loadClover, 60000);
    return () => clearInterval(t);
  }, [loadClover]);

  if (loading || !data) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-72 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const inventoryPie = [
    { name: "Active", value: data.inventory.active },
    { name: "Sold", value: data.inventory.sold },
    { name: "Returned", value: data.inventory.returned },
  ].filter((d) => d.value > 0);

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={[{ label: "Overview", href: "/insights" }, { label: "Reports", href: "/reports" }]} />
      <div>
        <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Store Insights</h1>
        <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">Real-time performance overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={clover?.ok ? "Revenue (30 days) · Clover" : "Revenue (30 days)"}
          value={formatCurrency(clover?.ok ? clover.total : data.last30Days.revenue)}
          sub={clover?.ok ? `${clover.count} card transactions` : `${data.last30Days.transactions} transactions`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label={clover?.ok ? "Today · Clover" : "All-Time Revenue"}
          value={formatCurrency(clover?.ok ? clover.todayTotal : data.allTime.revenue)}
          sub={clover?.ok ? `${clover.todayCount} transaction${clover.todayCount === 1 ? "" : "s"} today` : `${data.allTime.transactions} total sales`}
          icon={DollarSign}
          color="indigo"
        />
        <StatCard
          label="Sell-Through Rate"
          value={`${data.inventory.sellThroughRate}%`}
          sub={`${data.inventory.sold} of ${data.inventory.total} items sold`}
          icon={CheckCircle}
          color="purple"
        />
        <StatCard
          label="Consignor Payouts"
          value={formatCurrency(data.payouts.totalPaid)}
          sub={`${data.payouts.count} payouts issued`}
          icon={ShoppingBag}
          color="orange"
        />
      </div>

      {/* Clover live card transactions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Clover Card Transactions
          </CardTitle>
          <div className="flex items-center gap-3">
            {clover?.ok && cloverAt && <span className="text-xs text-gray-400 hidden sm:inline">updated {cloverAt}</span>}
            <button onClick={loadClover} disabled={cloverLoading} className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${cloverLoading ? "animate-spin" : ""}`} />
              {cloverLoading ? "Pulling…" : "Pull from Clover"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {!clover ? (
            <p className="text-sm text-gray-500">Loading Clover transactions…</p>
          ) : clover.configured === false ? (
            <p className="text-sm text-gray-600">{clover.error} <a href="/settings" className="text-accent font-medium underline">Open Settings</a></p>
          ) : clover.ok === false ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">{clover.error}</div>
              {clover.diag && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 font-mono space-y-0.5">
                  <div>Clover URL: {clover.diag.base} {clover.diag.isSandbox ? "⚠️ SANDBOX" : "(production)"}</div>
                  <div>Merchant ID: {clover.diag.merchantIdMask} — from {clover.diag.merchantSource}</div>
                  <div>API token from: {clover.diag.keySource}</div>
                  {clover.status && <div>HTTP status: {clover.status}</div>}
                  {clover.detail && <div className="text-gray-400 break-all">Clover said: {clover.detail}</div>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-500 uppercase">Today</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(clover.todayTotal)}</p><p className="text-xs text-gray-500">{clover.todayCount} transaction{clover.todayCount === 1 ? "" : "s"}</p></div>
                <div><p className="text-xs text-gray-500 uppercase">Last 30 days</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(clover.total)}</p><p className="text-xs text-gray-500">{clover.count} transaction{clover.count === 1 ? "" : "s"}</p></div>
              </div>
              {clover.recent?.length > 0 ? (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recent transactions</p>
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {clover.recent.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="text-gray-700">{new Date(t.createdTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                          <p className="text-xs text-gray-400">{t.tender}</p>
                        </div>
                        <p className="font-semibold text-gray-900">{formatCurrency(t.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 border-t border-gray-100 pt-3">No Clover transactions in the last 30 days.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Revenue — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.revenueByDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(v: any) => [formatCurrency(Number(v)), "Revenue"]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#6366f1" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom row: categories + inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top categories bar chart */}
        <Card>
          <CardHeader><CardTitle>Top Categories by Items Sold</CardTitle></CardHeader>
          <CardContent>
            {data.topCategories.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No sales data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topCategories} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v: any) => [Number(v), "Items sold"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="sold" radius={[0, 4, 4, 0]}>
                    {data.topCategories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Inventory health pie */}
        <Card>
          <CardHeader><CardTitle>Inventory Status</CardTitle></CardHeader>
          <CardContent>
            {inventoryPie.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No inventory yet
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={inventoryPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {inventoryPie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {inventoryPie.map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-gray-600">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">{entry.value}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({data.inventory.total > 0 ? ((entry.value / data.inventory.total) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Sell-through</span>
                      <span className="text-sm font-bold text-indigo-600">{data.inventory.sellThroughRate}%</span>
                    </div>
                    <div className="mt-1.5 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${data.inventory.sellThroughRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
