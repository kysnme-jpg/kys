"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, ShoppingBag, Users, DollarSign, Download } from "lucide-react";

export default function ReportsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sales?limit=25").then((r) => r.json()).then((d) => setSales(d.sales || []));
  }, []);

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalItems = sales.reduce((s, sale) => s + sale.items.length, 0);

  const exportCSV = async (type: string) => {
    setExporting(type);
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/export?${params}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.headers.get("content-disposition")?.split('filename="')[1]?.replace('"', '') || `${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={[{ label: "Overview", href: "/insights" }, { label: "Reports", href: "/reports" }]} />
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Reports</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Revenue (recent)", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-green-600" },
          { label: "Transactions", value: sales.length, icon: ShoppingBag, color: "text-indigo-600" },
          { label: "Items Sold", value: totalItems, icon: TrendingUp, color: "text-purple-600" },
          { label: "Avg Sale", value: formatCurrency(sales.length ? totalRevenue / sales.length : 0), icon: Users, color: "text-orange-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <Icon className={`h-8 w-8 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CSV Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-9" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 h-9" />
            </div>
            <p className="text-xs text-gray-400 pb-2">Leave blank for all-time</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { type: "sales", label: "Sales" },
              { type: "inventory", label: "Inventory" },
              { type: "consignors", label: "Consignors" },
              { type: "ledger", label: "Ledger" },
            ].map(({ type, label }) => (
              <Button
                key={type}
                variant="outline"
                onClick={() => exportCSV(type)}
                disabled={exporting === type}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {exporting === type ? "Exporting..." : `Export ${label} CSV`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent sales */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sales.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm">No sales yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-600">Sale ID</th>
                  <th className="text-left p-4 font-medium text-gray-600">Customer</th>
                  <th className="text-center p-4 font-medium text-gray-600">Items</th>
                  <th className="text-right p-4 font-medium text-gray-600">Total</th>
                  <th className="text-left p-4 font-medium text-gray-600">Payment</th>
                  <th className="text-left p-4 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-xs text-gray-500">{sale.id.slice(-8)}</td>
                    <td className="p-4 text-gray-700">
                      {sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : "Walk-in"}
                    </td>
                    <td className="p-4 text-center text-gray-700">{sale.items.length}</td>
                    <td className="p-4 text-right font-semibold text-gray-900">{formatCurrency(sale.total)}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                        {sale.paymentMethod.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 text-xs">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
