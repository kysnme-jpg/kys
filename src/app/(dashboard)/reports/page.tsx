"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, ShoppingBag, Users, DollarSign } from "lucide-react";

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/sales?limit=10").then((r) => r.json()).then((d) => setSales(d.sales || []));
  }, []);

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalItems = sales.reduce((s, sale) => s + sale.items.length, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

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
