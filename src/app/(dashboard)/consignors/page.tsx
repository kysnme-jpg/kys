"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Users } from "lucide-react";
import Link from "next/link";

interface Consignor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  splitPercent: number;
  balance: number;
  createdAt: string;
  _count: { items: number };
}

export default function ConsignorsPage() {
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/consignors?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setConsignors(data.consignors || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalBalance = consignors.reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consignors</h1>
          <p className="text-sm text-gray-500">
            {consignors.length} consignors · {formatCurrency(totalBalance)} total owed
          </p>
        </div>
        <Link href="/consignors/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Consignor
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-10"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : consignors.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No consignors yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Name</th>
                <th className="text-left p-4 font-medium text-gray-600">Contact</th>
                <th className="text-center p-4 font-medium text-gray-600">Split</th>
                <th className="text-center p-4 font-medium text-gray-600">Items</th>
                <th className="text-right p-4 font-medium text-gray-600">Balance</th>
                <th className="text-left p-4 font-medium text-gray-600">Since</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consignors.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                  </td>
                  <td className="p-4 text-gray-600">
                    <p>{c.email}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {c.splitPercent}%
                    </span>
                  </td>
                  <td className="p-4 text-center text-gray-700">{c._count.items}</td>
                  <td className="p-4 text-right">
                    <span className={`font-semibold ${c.balance > 0 ? "text-green-700" : "text-gray-500"}`}>
                      {formatCurrency(c.balance)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{formatDate(c.createdAt)}</td>
                  <td className="p-4">
                    <Link href={`/consignors/${c.id}`} className="text-indigo-600 hover:underline text-xs font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
