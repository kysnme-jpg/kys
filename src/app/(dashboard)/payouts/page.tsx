"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Users, CheckCircle, AlertCircle, Receipt, Banknote, Clock } from "lucide-react";

interface ConsignorBalance {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  balance: number;
  splitPercent: number;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  status: string;
  checkNumber?: string;
  createdAt: string;
  completedAt?: string;
  note?: string;
  consignor: { firstName: string; lastName: string };
}

export default function PayoutsPage() {
  const [consignors, setConsignors] = useState<ConsignorBalance[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [singleConsignor, setSingleConsignor] = useState<ConsignorBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  // Payout form
  const [payoutMethod, setPayoutMethod] = useState<"CHECK" | "CASH" | "ACH" | "ZELLE" | "CASHAPP">("CHECK");
  const [startCheck, setStartCheck] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ name: string; amount: number; status: "ok" | "err" }[]>([]);

  const load = async () => {
    setLoading(true);
    const [cRes, pRes] = await Promise.all([
      fetch("/api/consignors"),
      fetch("/api/payouts"),
    ]);
    const cData = await cRes.json();
    const pData = await pRes.json();
    setConsignors((cData.consignors || []).filter((c: ConsignorBalance) => c.balance > 0));
    setPayouts(pData.payouts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalOwed = consignors.reduce((s, c) => s + c.balance, 0);
  const selectedConsignors = consignors.filter((c) => selected.has(c.id));
  const selectedTotal = selectedConsignors.reduce((s, c) => s + c.balance, 0);

  const toggleAll = () => {
    if (selected.size === consignors.length) setSelected(new Set());
    else setSelected(new Set(consignors.map((c) => c.id)));
  };

  const issueSinglePayout = async (consignorId: string, amount: number, method: string, checkNumber?: string) => {
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consignorId, amount, method, checkNumber }),
    });
    return res.ok;
  };

  const handleBatchPayout = async () => {
    setProcessing(true);
    setResults([]);

    let checkNum = parseInt(startCheck) || null;
    const resultList: { name: string; amount: number; status: "ok" | "err" }[] = [];

    for (const c of selectedConsignors) {
      const checkNumber = checkNum ? String(checkNum) : undefined;
      const ok = await issueSinglePayout(c.id, c.balance, payoutMethod, checkNumber);
      resultList.push({
        name: `${c.firstName} ${c.lastName}`,
        amount: c.balance,
        status: ok ? "ok" : "err",
      });
      if (checkNum) checkNum++;
    }

    setResults(resultList);
    setProcessing(false);
    setSelected(new Set());
    load();
  };

  const methodIcon: Record<string, any> = { CHECK: Receipt, CASH: Banknote, ACH: Clock, ZELLE: Receipt, CASHAPP: Receipt };

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Payouts</h1>
          <p className="text-sm text-gray-500">
            {consignors.length} consignors with balances · {formatCurrency(totalOwed)} total owed
          </p>
        </div>
        {selected.size > 0 && (
          <Button onClick={() => setBatchOpen(true)} className="gap-2">
            <DollarSign className="h-4 w-4" />
            Pay {selected.size} Consignors ({formatCurrency(selectedTotal)})
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-red-50 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Total Owed</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalOwed)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Consignors with Balance</p>
              <p className="text-xl font-bold text-gray-900">{consignors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Payouts This Month</p>
              <p className="text-xl font-bold text-gray-900">
                {payouts.filter((p) => new Date(p.createdAt).getMonth() === new Date().getMonth()).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["pending", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "pending" ? "Pending Balances" : "Payout History"}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : consignors.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">All caught up!</p>
              <p className="text-sm text-gray-500">No consignors have outstanding balances.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === consignors.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </th>
                  <th className="text-left p-4 font-medium text-gray-600">Consignor</th>
                  <th className="text-center p-4 font-medium text-gray-600">Split</th>
                  <th className="text-right p-4 font-medium text-gray-600">Balance</th>
                  <th className="p-4 text-right font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consignors.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${selected.has(c.id) ? "bg-indigo-50" : ""}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          setSelected(next);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      />
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                      {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                        {c.splitPercent}%
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-green-700 text-base">
                      {formatCurrency(c.balance)}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSingleConsignor(c); setBatchOpen(true); setSelected(new Set([c.id])); }}
                      >
                        Pay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {payouts.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm">No payouts processed yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-600">Consignor</th>
                  <th className="text-right p-4 font-medium text-gray-600">Amount</th>
                  <th className="text-left p-4 font-medium text-gray-600">Method</th>
                  <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  <th className="text-left p-4 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => {
                  const Icon = methodIcon[p.method as keyof typeof methodIcon] || Receipt;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">
                        {p.consignor.firstName} {p.consignor.lastName}
                      </td>
                      <td className="p-4 text-right font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Icon className="h-4 w-4 text-gray-400" />
                          {p.method}{p.checkNumber && ` #${p.checkNumber}`}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={p.status === "COMPLETED" ? "success" : p.status === "FAILED" ? "danger" : "warning"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Batch payout modal */}
      <Modal
        open={batchOpen}
        onClose={() => { setBatchOpen(false); setResults([]); setSingleConsignor(null); }}
        title={selected.size === 1 ? "Issue Payout" : `Batch Payout — ${selected.size} Consignors`}
        className="max-w-lg"
      >
        {results.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Payout Results</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((r) => (
                <div key={r.name} className={`flex items-center justify-between p-3 rounded-lg ${r.status === "ok" ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="flex items-center gap-2">
                    {r.status === "ok"
                      ? <CheckCircle className="h-4 w-4 text-green-600" />
                      : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <span className="text-sm font-medium">{r.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(r.amount)}</span>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => { setBatchOpen(false); setResults([]); setSingleConsignor(null); }}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Consignors</span>
                <span className="font-medium">{selectedConsignors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">Total to pay out</span>
                <span className="font-bold text-lg text-indigo-700">{formatCurrency(selectedTotal)}</span>
              </div>
              {selectedConsignors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                  {selectedConsignors.map((c) => (
                    <div key={c.id} className="flex justify-between text-xs text-gray-500">
                      <span>{c.firstName} {c.lastName}</span>
                      <span>{formatCurrency(c.balance)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {([["CHECK","Check"],["CASH","Cash"],["ZELLE","Zelle"],["CASHAPP","Cash App"],["ACH","ACH"]] as const).map(([m,label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayoutMethod(m)}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      payoutMethod === m ? "bg-accent text-[var(--accent-ink)]" : "bg-chip text-ink hover:brightness-95"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">Zelle, Cash App and Check use each consignor&apos;s saved payout details.</p>
            </div>

            {payoutMethod === "CHECK" && selectedConsignors.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Check Number
                </label>
                <p className="text-xs text-gray-500 mb-1">Checks will be numbered sequentially from this number</p>
                <Input
                  type="number"
                  value={startCheck}
                  onChange={(e) => setStartCheck(e.target.value)}
                  placeholder="e.g. 1042"
                  className="w-32"
                />
              </div>
            )}

            {payoutMethod === "CHECK" && selectedConsignors.length === 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
                <Input
                  type="text"
                  value={startCheck}
                  onChange={(e) => setStartCheck(e.target.value)}
                  placeholder="e.g. 1042"
                  className="w-32"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleBatchPayout}
                disabled={processing || selectedConsignors.length === 0}
                className="flex-1"
              >
                {processing ? "Processing..." : `Issue ${selectedConsignors.length === 1 ? "Payout" : `${selectedConsignors.length} Payouts`}`}
              </Button>
              <Button variant="outline" onClick={() => { setBatchOpen(false); setSingleConsignor(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
