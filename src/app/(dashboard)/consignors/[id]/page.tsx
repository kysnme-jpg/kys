"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PrintLabelButton } from "@/components/inventory/label-print";
import { formatCurrency, formatDate, calcConsignorCredit } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft, DollarSign, Package, Receipt, User, Phone, Mail, Plus, Pencil,
  TrendingUp, CheckCircle, Clock, Banknote
} from "lucide-react";

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
  const [payoutMethod, setPayoutMethod] = useState<"CHECK" | "CASH" | "ACH" | "ZELLE" | "CASHAPP">("CHECK");
  const [destination, setDestination] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [editItemSaving, setEditItemSaving] = useState(false);
  const [editPayout, setEditPayout] = useState<any>(null);
  const [editPayoutSaving, setEditPayoutSaving] = useState(false);
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

  // Prefill the destination from the consignor's saved details when the method changes.
  useEffect(() => {
    const c: any = consignor;
    if (!c) return;
    if (payoutMethod === "ZELLE") setDestination(c.zelleHandle || "");
    else if (payoutMethod === "CASHAPP") setDestination(c.cashAppHandle || "");
    else if (payoutMethod === "CHECK") setDestination(c.address || "");
    else setDestination("");
  }, [payoutMethod, consignor]);

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
        destination: destination.trim() || undefined,
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

  const saveItem = async () => {
    if (!editItem) return;
    setEditItemSaving(true);
    const res = await fetch(`/api/items/${editItem.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editItem.title, brand: editItem.brand, size: editItem.size, price: parseFloat(editItem.price) || 0, costPrice: editItem.costPrice === "" ? null : editItem.costPrice, status: editItem.status, location: editItem.location }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Couldn't save item");
      setEditItemSaving(false);
      return;
    }
    setEditItemSaving(false); setEditItem(null); load();
  };

  const savePayout = async () => {
    if (!editPayout) return;
    setEditPayoutSaving(true);
    const res = await fetch(`/api/payouts/${editPayout.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(editPayout.amount) || 0, method: editPayout.method, checkNumber: editPayout.checkNumber, destination: editPayout.destination, status: editPayout.status, note: editPayout.note }),
    });
    const d = await res.json();
    setEditPayoutSaving(false);
    if (!res.ok) { alert(d.error || "Couldn't save payout"); return; }
    setEditPayout(null); load();
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
            <div className="flex justify-end">
              <Link href={`/inventory/new?consignorId=${consignor.id}`}>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add item</Button>
              </Link>
            </div>
            {consignor.items.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="h-9 w-9 text-[var(--muted)] mx-auto mb-2" />
                <p className="text-[var(--muted)] mb-4">No items yet</p>
                <Link href={`/inventory/new?consignorId=${consignor.id}`}>
                  <Button className="gap-1.5"><Plus className="h-4 w-4" /> Add their first item</Button>
                </Link>
              </div>
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
                    <p className="text-xs text-gray-500">
                      {[item.brand, `SKU: ${item.sku}`, item.location ? (item.location === "STORAGE" ? "Storage" : "In-store") : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(item.price)}</p>
                    {item.costPrice != null && <p className="text-xs text-gray-500">Cost {formatCurrency(item.costPrice)}</p>}
                    <p className="text-xs text-gray-500">{calcConsignorCredit(item.price, item.splitPercent ?? consignor.splitPercent).toFixed(2)} to consignor</p>
                  </div>
                  <Badge variant={itemStatusColors[item.status]}>{item.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setEditItem({ ...item, costPrice: item.costPrice ?? "" })}><Pencil className="h-3.5 w-3.5" /></Button>
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
                    <th className="p-4" />
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
                      <td className="p-4 text-gray-500 text-xs">{payout.destination || payout.note || ""}</td>
                      <td className="p-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditPayout({ ...payout, amount: String(payout.amount) })}><Pencil className="h-3.5 w-3.5" /></Button>
                      </td>
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
            <div className="grid grid-cols-3 gap-2">
              {([["CHECK", "Check"], ["CASH", "Cash"], ["ZELLE", "Zelle"], ["CASHAPP", "Cash App"], ["ACH", "ACH"]] as const).map(([m, label]) => (
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
          </div>

          {payoutMethod === "CHECK" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
                <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="e.g. 1042" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mailing address</label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Address to mail the check" />
              </div>
            </>
          )}
          {payoutMethod === "ZELLE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zelle (phone or email)</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. 443-000-0000 or name@email.com" />
            </div>
          )}
          {payoutMethod === "CASHAPP" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash App $Cashtag</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. $classicconsigns" />
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

      {/* Edit item modal */}
      {editItem && (
        <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Item" className="max-w-lg">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><Input value={editItem.title} onChange={(e) => setEditItem({ ...editItem, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Brand</label><Input value={editItem.brand || ""} onChange={(e) => setEditItem({ ...editItem, brand: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Size</label><Input value={editItem.size || ""} onChange={(e) => setEditItem({ ...editItem, size: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Price</label><Input type="number" min={0} step="0.01" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Cost</label><Input type="number" min={0} step="0.01" value={editItem.costPrice} onChange={(e) => setEditItem({ ...editItem, costPrice: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={editItem.status} onChange={(e) => setEditItem({ ...editItem, status: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                  {["ACTIVE", "SOLD", "RETURNED", "EXPIRED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select value={editItem.location || ""} onChange={(e) => setEditItem({ ...editItem, location: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                  <option value="">—</option><option value="IN_STORE">In-store</option><option value="STORAGE">Storage</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1"><Button onClick={saveItem} disabled={editItemSaving} className="flex-1">{editItemSaving ? "Saving…" : "Save item"}</Button><Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button></div>
          </div>
        </Modal>
      )}

      {/* Edit payout modal */}
      {editPayout && (
        <Modal open={!!editPayout} onClose={() => setEditPayout(null)} title="Edit Payout" className="max-w-md">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount</label><Input type="number" min={0} step="0.01" value={editPayout.amount} onChange={(e) => setEditPayout({ ...editPayout, amount: e.target.value })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <div className="grid grid-cols-3 gap-2">
                {([["CHECK", "Check"], ["CASH", "Cash"], ["ZELLE", "Zelle"], ["CASHAPP", "Cash App"], ["ACH", "ACH"]] as const).map(([m, label]) => (
                  <button key={m} type="button" onClick={() => setEditPayout({ ...editPayout, method: m })} className={`py-2.5 rounded-lg text-sm font-semibold ${editPayout.method === m ? "bg-accent text-[var(--accent-ink)]" : "bg-chip text-ink"}`}>{label}</button>
                ))}
              </div>
            </div>
            {editPayout.method === "CHECK" && <div><label className="block text-sm font-medium text-gray-700 mb-1">Check number</label><Input value={editPayout.checkNumber || ""} onChange={(e) => setEditPayout({ ...editPayout, checkNumber: e.target.value })} /></div>}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination</label><Input value={editPayout.destination || ""} onChange={(e) => setEditPayout({ ...editPayout, destination: e.target.value })} placeholder="Zelle / $Cashtag / address" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={editPayout.status} onChange={(e) => setEditPayout({ ...editPayout, status: e.target.value })} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                {["PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label><Input value={editPayout.note || ""} onChange={(e) => setEditPayout({ ...editPayout, note: e.target.value })} /></div>
            <div className="flex gap-2 pt-1"><Button onClick={savePayout} disabled={editPayoutSaving} className="flex-1">{editPayoutSaving ? "Saving…" : "Save payout"}</Button><Button variant="outline" onClick={() => setEditPayout(null)}>Cancel</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
