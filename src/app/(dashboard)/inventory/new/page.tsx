"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUpload } from "@/components/inventory/photo-upload";
import { PrintLabelButton } from "@/components/inventory/label-print";
import { ArrowLeft, Save, Tag } from "lucide-react";
import Link from "next/link";

interface Consignor {
  id: string;
  firstName: string;
  lastName: string;
  splitPercent: number;
}

interface Category {
  id: string;
  name: string;
}

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

export default function NewItemPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<any>(null);
  const [error, setError] = useState("");
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [form, setForm] = useState({
    title: "",
    brand: "",
    size: "",
    color: "",
    condition: "Good",
    description: "",
    price: "",
    type: "CONSIGNED" as "CONSIGNED" | "OWNED",
    consignorId: "",
    splitPercent: "",
    categoryId: "",
    barcode: "",
    listedOnline: false,
    expiresAt: "",
    photoUrls: [] as string[],
  });

  useEffect(() => {
    fetch("/api/consignors").then((r) => r.json()).then((d) => setConsignors(d.consignors || []));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleConsignorChange = (id: string) => {
    const c = consignors.find((c) => c.id === id);
    set("consignorId", id);
    if (c) set("splitPercent", String(c.splitPercent));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price) { setError("Title and price are required"); return; }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      price: parseFloat(form.price),
      splitPercent: form.splitPercent ? parseFloat(form.splitPercent) : undefined,
      consignorId: form.consignorId || undefined,
      categoryId: form.categoryId || undefined,
      barcode: form.barcode || undefined,
      expiresAt: form.expiresAt || undefined,
    };

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    setSaved(data);
    setSaving(false);
  };

  const handleSaveAnother = () => {
    setSaved(null);
    setForm((f) => ({
      ...f,
      title: "",
      brand: "",
      size: "",
      color: "",
      description: "",
      price: "",
      barcode: "",
      photoUrls: [],
    }));
  };

  if (saved) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Tag className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Item Added!</h2>
            <p className="text-gray-600">{saved.title}</p>
            <p className="text-sm text-gray-500 font-mono">SKU: {saved.sku}</p>

            <div className="flex gap-3 justify-center pt-2">
              <PrintLabelButton item={saved} size="default" />
              <Button onClick={handleSaveAnother} variant="outline">Add Another</Button>
              <Button onClick={() => router.push("/inventory")}>View Inventory</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Item</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <Input
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="e.g. Vintage Levi's 501 Jeans"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Nike, Levi's..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <Input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="M, 32x30, 8..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Blue, Black..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                    <select
                      value={form.condition}
                      onChange={(e) => set("condition", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Describe the item for the online store..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode / SKU override</label>
                  <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan or type barcode" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Pricing & Ownership</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                  <div className="flex gap-2">
                    {(["CONSIGNED", "OWNED"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set("type", t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          form.type === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {t === "CONSIGNED" ? "Consigned" : "Store-Owned"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {form.type === "CONSIGNED" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Consignor</label>
                      <select
                        value={form.consignorId}
                        onChange={(e) => handleConsignorChange(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select consignor...</option>
                        {consignors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName} ({c.splitPercent}% split)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Consignor Split %</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={form.splitPercent}
                          onChange={(e) => set("splitPercent", e.target.value)}
                          placeholder="50"
                          className="w-24"
                        />
                        <span className="text-sm text-gray-500">
                          {form.price && form.splitPercent
                            ? `Consignor gets $${((parseFloat(form.price) * parseFloat(form.splitPercent)) / 100).toFixed(2)}`
                            : "Enter price and split to see payout"}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires (optional)</label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => set("expiresAt", e.target.value)}
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.listedOnline}
                    onChange={(e) => set("listedOnline", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">List on public online shop</span>
                </label>
              </CardContent>
            </Card>
          </div>

          {/* Right column — Photos */}
          <div>
            <Card>
              <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
              <CardContent>
                <PhotoUpload
                  value={form.photoUrls}
                  onChange={(urls) => set("photoUrls", urls)}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Item"}
          </Button>
          <Link href="/inventory">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
