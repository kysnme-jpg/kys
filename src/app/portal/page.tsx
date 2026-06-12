"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, calcConsignorCredit } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Package, TrendingUp, LogOut, ShoppingBag, Clock } from "lucide-react";

interface PortalData {
  firstName: string;
  lastName: string;
  balance: number;
  splitPercent: number;
  store: { name: string; logoUrl?: string };
  items: any[];
  ledgerEntries: any[];
}

const statusColors: Record<string, "success" | "default" | "warning"> = {
  ACTIVE: "success",
  SOLD: "default",
  RETURNED: "warning",
};

const ledgerColors: Record<string, string> = {
  SALE_CREDIT: "text-green-600",
  PAYOUT_DEBIT: "text-red-600",
  FEE_DEBIT: "text-orange-600",
  ADJUSTMENT: "text-blue-600",
};

export default function PortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"items" | "ledger">("items");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    fetch("/api/portal/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => { if (d) { setData(d); setLoading(false); } });
  }, [router]);

  const signOut = () => {
    localStorage.removeItem("portal_token");
    router.push("/portal/login");
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeItems = data.items.filter((i) => i.status === "ACTIVE");
  const soldItems = data.items.filter((i) => i.status === "SOLD");
  const totalEarned = data.ledgerEntries
    .filter((e) => e.type === "SALE_CREDIT")
    .reduce((s: number, e: any) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{data.store.name}</p>
              <p className="text-sm font-semibold text-gray-900">
                {data.firstName} {data.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Balance hero */}
        <div className="bg-indigo-600 rounded-2xl p-6 text-white">
          <p className="text-indigo-200 text-sm font-medium">Available Balance</p>
          <p className="text-4xl font-bold mt-1">{formatCurrency(data.balance)}</p>
          <p className="text-indigo-300 text-xs mt-2">
            Contact the store to request a payout
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active Items", value: activeItems.length, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Items Sold", value: soldItems.length, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
            { label: "Total Earned", value: formatCurrency(totalEarned), icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <div className={`h-9 w-9 ${bg} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`h-4.5 w-4.5 ${color}`} />
                </div>
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Split info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="h-9 w-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900">Your Split: {data.splitPercent}%</p>
            <p className="text-xs text-amber-700">You earn {data.splitPercent}% of each item sale price</p>
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 border-b border-gray-200 mb-4">
            {(["items", "ledger"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "items" ? `My Items (${data.items.length})` : "Earnings History"}
              </button>
            ))}
          </div>

          {/* Items */}
          {tab === "items" && (
            <div className="space-y-3">
              {data.items.length === 0 && (
                <p className="text-gray-500 text-sm py-4 text-center">No items on record yet</p>
              )}
              {data.items.map((item: any) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
                  {item.photoUrls?.[0] ? (
                    <img src={item.photoUrls[0]} className="h-16 w-16 rounded-lg object-cover shrink-0" alt="" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-400 text-xs">
                      No photo
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 text-sm leading-snug">{item.title}</p>
                      <Badge variant={statusColors[item.status]}>{item.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(item.price)}</p>
                      <p className="text-xs text-indigo-600 font-medium">
                        Your share: {formatCurrency(calcConsignorCredit(item.price, item.splitPercent ?? data.splitPercent))}
                      </p>
                    </div>
                    {item.status === "SOLD" && item.soldAt && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Sold {formatDate(item.soldAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ledger */}
          {tab === "ledger" && (
            <div className="space-y-2">
              {data.ledgerEntries.length === 0 && (
                <p className="text-gray-500 text-sm py-4 text-center">No transactions yet</p>
              )}
              {data.ledgerEntries.map((entry: any) => (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${ledgerColors[entry.type]}`}>
                      {entry.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{entry.note || "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className={`font-bold text-base ${entry.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {entry.amount >= 0 ? "+" : ""}{formatCurrency(entry.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
