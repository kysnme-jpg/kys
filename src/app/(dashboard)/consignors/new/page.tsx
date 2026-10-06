"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";

export default function NewConsignorPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    splitPercent: "50",
    payoutMethod: "",
    zelleHandle: "",
    cashAppHandle: "",
    unsoldPreference: "",
    notes: "",
    portalEnabled: false,
  });

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/consignors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
          splitPercent: parseFloat(form.splitPercent) || 50,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save this consignor. Please try again.");
        setSaving(false);
        return;
      }
      router.push(`/consignors/${data.id}`);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/consignors">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Consignor</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required placeholder="Sarah" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required placeholder="Johnson" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="sarah@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="555-0100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, City, ST 12345" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Agreement Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consignor Split %</label>
              <p className="text-xs text-gray-500 mb-2">The percentage of each sale the consignor receives (e.g. 50 means they get 50%)</p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={form.splitPercent}
                  onChange={(e) => set("splitPercent", e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-gray-600">
                  Store keeps {100 - parseInt(form.splitPercent || "0")}%
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred payout method</label>
              <select value={form.payoutMethod} onChange={(e) => set("payoutMethod", e.target.value)} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                <option value="">Choose…</option>
                <option value="CHECK">Check — mailed to address</option>
                <option value="CASH">Cash — in store</option>
                <option value="ZELLE">Zelle</option>
                <option value="CASHAPP">Cash App</option>
                <option value="ACH">Bank transfer (ACH)</option>
              </select>
            </div>
            {form.payoutMethod === "ZELLE" && (
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Zelle (phone or email)</label><Input value={form.zelleHandle} onChange={(e) => set("zelleHandle", e.target.value)} placeholder="443-000-0000 or name@email.com" /></div>
            )}
            {form.payoutMethod === "CASHAPP" && (
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Cash App $Cashtag</label><Input value={form.cashAppHandle} onChange={(e) => set("cashAppHandle", e.target.value)} placeholder="$classicconsigns" /></div>
            )}
            {form.payoutMethod === "CHECK" && (
              <p className="text-xs text-gray-500 -mt-1">Checks are mailed to the address entered above.</p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">If items don&apos;t sell</label>
              <select value={form.unsoldPreference} onChange={(e) => set("unsoldPreference", e.target.value)} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                <option value="">Choose…</option>
                <option value="PICKUP">Pick-up</option>
                <option value="DONATE">Donate</option>
                <option value="CONTINUE">Continue consigning (30 days)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Internal notes about this consignor..."
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.portalEnabled}
                onChange={(e) => set("portalEnabled", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Consignor Portal</span>
                <p className="text-xs text-gray-500">Consignor can log in to view their balance and items</p>
              </div>
            </label>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Add Consignor"}
          </Button>
          <Link href="/consignors">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
