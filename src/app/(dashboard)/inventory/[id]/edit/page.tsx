"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUpload } from "@/components/inventory/photo-upload";
import { PrintKysTagButton, PrintLabelButton } from "@/components/inventory/label-print";
import { AIEntry } from "@/components/inventory/ai-entry";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

interface Consignor { id: string; firstName: string; lastName: string; splitPercent: number; }
interface Category { id: string; name: string; }

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];
const STATUSES = ["ACTIVE", "SOLD", "RETURNED", "DONATED", "EXPIRED"];

export default function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [from, setFrom] = useState("/inventory");

  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("from");
    if (f) setFrom(f);
    Promise.all([
      fetch(`/api/items/${id}`).then((r) => r.json()),
      fetch("/api/consignors").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([item, c, cat]) => {
      setConsignors(c.consignors || []);
      setCategories(cat.categories || []);
      if (item && item.id) {
        setForm({
          title: item.title || "", brand: item.brand || "", size: item.size || "", color: item.color || "",
          condition: item.condition || "Good", description: item.description || "",
          price: item.price != null ? String(item.price) : "", type: item.type || "CONSIGNED",
          consignorId: item.consignorId || "", splitPercent: item.splitPercent != null ? String(item.splitPercent) : "",
          categoryId: item.categoryId || "", sku: item.sku || "", barcode: item.barcode || "",
          costPrice: item.costPrice != null ? String(item.costPrice) : "", location: item.location || "",
          status: item.status || "ACTIVE", listedOnline: !!item.listedOnline,
          expiresAt: item.expiresAt ? String(item.expiresAt).slice(0, 10) : "",
          photoUrls: item.photoUrls || [],
        });
      } else {
        setError("Item not found");
      }
      setLoading(false);
    });
  }, [id]);

  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const handleConsignorChange = (cid: string) => {
    const c = consignors.find((c) => c.id === cid);
    set("consignorId", cid);
    if (c) set("splitPercent", String(c.splitPercent));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price) { setError("Title and price are required"); return; }
    setSaving(true); setError("");
    const payload = {
      title: form.title, brand: form.brand, size: form.size, color: form.color, condition: form.condition,
      description: form.description, price: parseFloat(form.price) || 0,
      type: form.type,
      splitPercent: form.splitPercent ? parseFloat(form.splitPercent) : undefined,
      consignorId: form.consignorId || null, categoryId: form.categoryId || null,
      sku: form.sku.trim() || undefined, barcode: form.barcode || "",
      costPrice: form.costPrice === "" ? null : parseFloat(form.costPrice),
      location: form.location || "", status: form.status, listedOnline: form.listedOnline,
      expiresAt: form.expiresAt || null, photoUrls: form.photoUrls,
    };
    const res = await fetch(`/api/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Couldn't save"); return; }
    router.push(from);
  };

  const remove = async () => {
    if (!confirm("Delete this item? (Sold items can't be deleted.)")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || "Couldn't delete"); return; }
    router.push(from);
  };

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!form) return <div className="p-6 text-gray-500">{error || "Item not found"}</div>;

  const tagItem = { title: form.title, sku: form.sku, barcode: form.barcode, price: parseFloat(form.price) || 0, size: form.size, brand: form.brand, condition: form.condition, consignor: (() => { const c = consignors.find((c) => c.id === form.consignorId); return c ? `${c.firstName} ${c.lastName}` : undefined; })() };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(from)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Item</h1>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Brand</label><Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Size</label><Input value={form.size} onChange={(e) => set("size", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Color</label><Input value={form.color} onChange={(e) => set("color", e.target.value)} /></div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                    <select value={form.condition} onChange={(e) => set("condition", e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Describe the item for the online store..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">SKU</label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} className="font-mono" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Barcode (scan or type)</label><Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan barcode here" className="font-mono" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Cost (optional)</label><Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="What it cost you" /></div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <select value={form.location} onChange={(e) => set("location", e.target.value)} className="flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink focus:outline-none focus:border-accent">
                      <option value="">—</option><option value="IN_STORE">In-store</option><option value="STORAGE">Storage</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => set("status", e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
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
                      <button key={t} type="button" onClick={() => set("type", t)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                        {t === "CONSIGNED" ? "Consigned" : "Store-Owned"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <div className="relative"><span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className="pl-7" placeholder="0.00" required />
                  </div>
                </div>
                {form.type === "CONSIGNED" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Consignor</label>
                      <select value={form.consignorId} onChange={(e) => handleConsignorChange(e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select consignor...</option>
                        {consignors.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.splitPercent}% split)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Consignor Split %</label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min="0" max="100" value={form.splitPercent} onChange={(e) => set("splitPercent", e.target.value)} placeholder="50" className="w-24" />
                        <span className="text-sm text-gray-500">{form.price && form.splitPercent ? `Consignor gets $${((parseFloat(form.price) * parseFloat(form.splitPercent)) / 100).toFixed(2)}` : "Enter price and split to see payout"}</span>
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires (optional)</label>
                  <Input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.listedOnline} onChange={(e) => set("listedOnline", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">List on public online shop</span>
                </label>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Item Entry</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Upload a photo to auto-fill fields using AI</p>
              </CardHeader>
              <CardContent>
                <AIEntry
                  onResult={(result) => {
                    if (result.title) set("title", result.title);
                    if (result.brand) set("brand", result.brand);
                    if (result.condition) set("condition", result.condition);
                    if (result.size) set("size", result.size);
                    if (result.color) set("color", result.color);
                    if (result.description) set("description", result.description);
                    if (result.suggestedPrice) set("price", String(result.suggestedPrice));
                  }}
                  onPhotoUploaded={(url) => set("photoUrls", [...form.photoUrls, url])}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
              <CardContent><PhotoUpload value={form.photoUrls} onChange={(urls) => set("photoUrls", urls)} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Print</CardTitle></CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                <PrintKysTagButton item={tagItem} size="default" />
                <PrintLabelButton item={tagItem} size="default" />
              </CardContent>
            </Card>
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 items-center">
          <Button type="submit" disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save Item"}</Button>
          <Button variant="outline" type="button" onClick={() => router.push(from)}>Cancel</Button>
          <div className="flex-1" />
          <Button variant="outline" type="button" onClick={remove} className="gap-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </form>
    </div>
  );
}
