"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Package } from "lucide-react";
import Link from "next/link";

interface Item {
  id: string;
  title: string;
  sku: string;
  brand?: string;
  price: number;
  status: string;
  condition?: string;
  createdAt: string;
  consignor?: { firstName: string; lastName: string };
  category?: { name: string };
  photoUrls: string[];
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  SOLD: "bg-gray-100 text-gray-600",
  RETURNED: "bg-yellow-100 text-yellow-800",
  EXPIRED: "bg-red-100 text-red-800",
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [search, status]);

  async function fetchItems() {
    setLoading(true);
    const params = new URLSearchParams({ status, search });
    const res = await fetch(`/api/items?${params}`);
    const data = await res.json();
    setItems(data.items || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{total} items</p>
        </div>
        <Link href="/inventory/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          {["ACTIVE", "SOLD", "RETURNED", "EXPIRED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === s ? "bg-indigo-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No items found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Item</th>
                <th className="text-left p-4 font-medium text-gray-600">SKU</th>
                <th className="text-left p-4 font-medium text-gray-600">Consignor</th>
                <th className="text-left p-4 font-medium text-gray-600">Category</th>
                <th className="text-right p-4 font-medium text-gray-600">Price</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {item.photoUrls[0] ? (
                        <img src={item.photoUrls[0]} className="h-10 w-10 rounded object-cover" alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-100" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        {item.brand && <p className="text-xs text-gray-500">{item.brand}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-500 font-mono text-xs">{item.sku}</td>
                  <td className="p-4 text-gray-700">
                    {item.consignor
                      ? `${item.consignor.firstName} ${item.consignor.lastName}`
                      : <span className="text-gray-400">Store-owned</span>}
                  </td>
                  <td className="p-4 text-gray-500">{item.category?.name || "—"}</td>
                  <td className="p-4 text-right font-semibold text-gray-900">{formatCurrency(item.price)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
