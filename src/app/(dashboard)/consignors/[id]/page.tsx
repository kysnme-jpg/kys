"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PrintLabelButton } from "@/components/inventory/label-print";
import { formatCurrency, formatDate, calcConsignorCredit } from "@/lib/utils";
import {
  ArrowLeft, DollarSign, Package, Receipt, User, Phone, Mail,
  TrendingUp, CheckCircle, Clock, Banknote
} from "lucide-react";
import Link from "next/link";

interface ConsignorDetail {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  splitPercent: number;
  balance: number;
  createdAt: string;
  items: any[];
  ledgerEntries: any[];
  payouts: any[];
}

const itemStatusColors: Record<string, "success" | "default" | "warning" | "danger"> = {
  ACTIVE: "success",
  SOLD: "default",
  RETURNED: "warning",
  EXPIRED: "danger",
};

const ledgerColors: Record<string, string> = {
  SALE_CREDIT: "text-green-600",
  PAYOUT_DEBIT: "text-red-600",
  FEE_DEBIT: "text-orange-600",
  ADJUSTMENT: "text-blue-600",
};

export default function ConsignorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [consignor, setConsignor] = useState<ConsignorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "ledger" | "payouts">("items");

  // Payout form state
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"CHECK" | "CASH" | "ACH">("CHECK");
  const [checkNumber, setCheckNumber] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`/api/consignors/${id}`)
      .then((r) => r.json())
      .then((d) => { setConsignor(d); setLoading(false); });
  };

  useEffect(load, [id]);

  const handlePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { setPayoutError("Enter a valid amount"); return; }
    if (!consignor || amount > consignor.balance) { setPayoutError("Amount exceeds available balance"); return; }

    setPayoutLoading(true);
    setPayoutError("");

    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consignorId: id,
        amount,
        method: payoutMethod,
        checkNumber: checkNumber || undefined,
        note: payoutNote || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setPayoutError(data.error || "Payout failed");
      setPayoutLoading(false);
      return;
    }

    setPayoutOpen(false);
    setPayoutAmount("");
    setCheckNumber("");
    setPayoutNote("");
    setPayoutLoading(false);
    load(); // Refresh
  };

  if (loading || !consignor) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  const activeItems = consignor.items.filter((i) => i.status === "ACTIVE");
  const soldItems = consignor.items.filter((i) => i.status === "SOLD");
  const totalEarned = consignor.ledgerEntries
    .filter((e) => e.type === "SALE_CREDIT")
    .reduce((s: number, e: any) => s + e.amount, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/consignors">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {consignor.firstName} {consignor.lastName}
            </h1>
            <p className="text-sm text-gray-500">Member since {formatDate(consignor.createdAt)} · {consignor.splitPercent}% split</p>
          </div>
        </div>
        <Button
          onClick={() => { setPayoutAmount(String(consignor.balance.toFixed(2))); setPayoutOpen(true); }}
          disabled={consignor.balance <= 0}
          className="gap-2"
        >
          <DollarSign className="h-4 w-4" />
          Issue Payout
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Balance Owed", value: formatCurrency(consignor.balance), icon: DollarSign, color: consignor.balance > 0 ? "text-green-600" : "text-gray-400", bg: "bg-green-50" },
          { label: "Total Earned", value: formatCurrency(totalEarned), icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Active Items", value: activeItems.length, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Items Sold", value: soldItems.length, icon: CheckCircle, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contact info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-6">
            {consignor.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${consignor.email}`} className="hover:text-indigo-600">{consignor.email}</a>
              </div>
            )}
            {consignor.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${consignor.phone}`} className="hover:text-indigo-600">{consignor.phone}</a>
              </div>
            )}
            {consignor.address && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4 text-gray-400" />
                {consignor.address}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {(["items", "ledger", "payouts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
              {tab === "items" && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{consignor.items.length}</span>}
            </button>
          ))}
        </div>

        {/* Items tab */}
        {activeTab === "items" && (
          <div className="space-y-2">
            {consignor.items.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No items yet</p>
            ) : (
              consignor.items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200">
                  {item.photoUrls?.[0] ? (
                    <img src={item.photoUrls[0]} className="h-12 w-12 rounded object-cover" alt="" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.brand} · SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(item.price)}</p>
                    <p className="text-xs text-gray-500">{calcConsignorCredit(item.price, item.splitPercent ?? consignor.splitPercent).toFixed(2)} to consignor</p>
                  </div>
                  <Badge variant={itemStatusColors[item.status]}>{item.status}</Badge>
                  {item.status === "ACTIVE" && (
                    <PrintLabelButton item={item} size="sm" />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Ledger tab */}
        {activeTab === "ledger" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {consignor.ledgerEntries.length === 0 ? (
              <p className="p-6 text-gray-500 text-sm">No ledger entries yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-600">Type</th>
                    <th className="text-left p-4 font-medium text-gray-600">Note</th>
                    <th className="text-right p-4 font-medium text-gray-600">Amount</th>
                    <th className="text-left p-4 font-medium text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consignor.ledgerEntries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <span className={`font-medium text-xs ${ledgerColors[entry.type]}`}>
                          {entry.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 text-xs">{entry.note || "—"}</td>
                      <td className={`p-4 text-right font-semibold ${entry.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {entry.amount >= 0 ? "+" : ""}{formatCurrency(entry.amount)}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Payouts tab */}
        {activeTab === "payouts" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {consignor.payouts.length === 0 ? (
              <p className="p-6 text-gray-500 text-sm">No payouts yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-right p-4 font-medium text-gray-600">Amount</th>
                    <th className="text-left p-4 font-medium text-gray-600">Method</th>
                    <th className="text-left p-4 font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 font-medium text-gray-600">Date</th>
                    <th className="text-left p-4 font-medium text-gray-600">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consignor.payouts.map((payout: any) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="p-4 text-right font-semibold text-gray-900">{formatCurrency(payout.amount)}</td>
                      <td className="p-4 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          {payout.method === "CHECK" && <Receipt className="h-3.5 w-3.5 text-gray-400" />}
                          {payout.method === "CASH" && <Banknote className="h-3.5 w-3.5 text-gray-400" />}
                          {payout.method === "ACH" && <Clock className="h-3.5 w-3.5 text-gray-400" />}
                          {payout.method}{payout.checkNumber && ` #${payout.checkNumber}`}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={payout.status === "COMPLETED" ? "success" : payout.status === "FAILED" ? "danger" : "warning"}>
                          {payout.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{formatDate(payout.createdAt)}</td>
                      <td className="p-4 text-gray-500 text-xs">{payout.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Payout modal */}
      <Modal open={payoutOpen} onClose={() => setPayoutOpen(false)} title="Issue Payout" className="max-w-md">
        <div className="space-y-4">
          <div className="rounded-lg bg-indigo-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-700 font-medium">Available Balance</p>
              <p className="text-2xl font-bold text-indigo-900">{formatCurrency(consignor.balance)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-indigo-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={consignor.balance}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <div className="flex gap-2">
              {(["CHECK", "CASH", "ACH"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayoutMethod(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    payoutMethod === m ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {payoutMethod === "CHECK" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
              <Input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g. 1042"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <Input
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              placeholder="Add a note for this payout..."
            />
          </div>

          {payoutError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{payoutError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handlePayout}
              disabled={payoutLoading}
              className="flex-1"
            >
              {payoutLoading ? "Processing..." : `Issue ${payoutAmount ? formatCurrency(parseFloat(payoutAmount)) : "Payout"}`}
            </Button>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
