"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUpload } from "@/components/inventory/photo-upload";
import { AIEntry } from "@/components/inventory/ai-entry";
import { Plus, Trash2, Send, CheckCircle, LogOut, Package } from "lucide-react";

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

interface DraftItem {
  id: string;
  title: string;
  brand: string;
  size: string;
  color: string;
  condition: string;
  description: string;
  photoUrls: string[];
  suggestedPrice: string;
}

const emptyItem = (): DraftItem => ({
  id: Math.random().toString(36),
  title: "",
  brand: "",
  size: "",
  color: "",
  condition: "Good",
  description: "",
  photoUrls: [],
  suggestedPrice: "",
});

export default function DealerPortalPage() {
  const [consignor, setConsignor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [activeItemId, setActiveItemId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
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
      .then((d) => {
        if (d) {
          setConsignor(d);
          setLoading(false);
          setActiveItemId(items[0].id);
        }
      });
  }, []);

  const updateItem = (id: string, key: string, value: any) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [key]: value } : i));
  };

  const addItem = () => {
    const item = emptyItem();
    setItems((prev) => [...prev, item]);
    setActiveItemId(item.id);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length === 0) return [emptyItem()];
      setActiveItemId(next[next.length - 1].id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const valid = items.filter((i) => i.title.trim());
    if (valid.length === 0) return;

    setSubmitting(true);
    const token = localStorage.getItem("portal_token");

    const res = await fetch("/api/dealer/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        items: valid.map((i) => ({
          ...i,
          suggestedPrice: i.suggestedPrice ? parseFloat(i.suggestedPrice) : undefined,
        })),
      }),
    });

    const data = await res.json();
    setSubmitted(data.message || "Submitted!");
    setSubmitting(false);
    setItems([emptyItem()]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Items Submitted!</h2>
            <p className="text-gray-600 text-sm">{submitted}</p>
            <Button className="w-full" onClick={() => setSubmitted(null)}>
              Submit More Items
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeItem = items.find((i) => i.id === activeItemId) || items[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dealer Entry</h1>
            <p className="text-xs text-gray-500">{consignor?.firstName} {consignor?.lastName} · {consignor?.store?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting || items.every((i) => !i.title.trim())}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting..." : `Submit ${items.filter((i) => i.title.trim()).length} Item(s)`}
            </Button>
            <button
              onClick={() => { localStorage.removeItem("portal_token"); router.push("/portal/login"); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6">
        {/* Item list sidebar */}
        <div className="w-56 shrink-0 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Items to Submit</p>
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setActiveItemId(item.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                activeItemId === item.id
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded flex items-center justify-center text-xs font-bold ${
                  activeItemId === item.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {i + 1}
                </div>
                <p className="text-xs font-medium text-gray-700 truncate">
                  {item.title || "Untitled"}
                </p>
              </div>
            </button>
          ))}
          <button
            onClick={addItem}
            className="w-full p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>

        {/* Active item form */}
        {activeItem && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Item {items.findIndex((i) => i.id === activeItem.id) + 1}
              </h2>
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(activeItem.id)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">AI Auto-Fill</CardTitle></CardHeader>
              <CardContent>
                <AIEntry
                  onResult={(result) => {
                    if (result.title) updateItem(activeItem.id, "title", result.title);
                    if (result.brand) updateItem(activeItem.id, "brand", result.brand);
                    if (result.condition) updateItem(activeItem.id, "condition", result.condition);
                    if (result.size) updateItem(activeItem.id, "size", result.size);
                    if (result.color) updateItem(activeItem.id, "color", result.color);
                    if (result.description) updateItem(activeItem.id, "description", result.description);
                    if (result.suggestedPrice) updateItem(activeItem.id, "suggestedPrice", String(result.suggestedPrice));
                  }}
                  onPhotoUploaded={(url) => updateItem(activeItem.id, "photoUrls", [...activeItem.photoUrls, url])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Item Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <Input
                    value={activeItem.title}
                    onChange={(e) => updateItem(activeItem.id, "title", e.target.value)}
                    placeholder="Describe the item..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <Input value={activeItem.brand} onChange={(e) => updateItem(activeItem.id, "brand", e.target.value)} placeholder="Brand name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <Input value={activeItem.size} onChange={(e) => updateItem(activeItem.id, "size", e.target.value)} placeholder="M, 32, 8..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <Input value={activeItem.color} onChange={(e) => updateItem(activeItem.id, "color", e.target.value)} placeholder="Blue..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                    <select
                      value={activeItem.condition}
                      onChange={(e) => updateItem(activeItem.id, "condition", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={activeItem.description}
                    onChange={(e) => updateItem(activeItem.id, "description", e.target.value)}
                    rows={2}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Any details that would help price or sell this item..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Price (optional)</label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={activeItem.suggestedPrice}
                      onChange={(e) => updateItem(activeItem.id, "suggestedPrice", e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Store sets final price</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
              <CardContent>
                <PhotoUpload
                  value={activeItem.photoUrls}
                  onChange={(urls) => updateItem(activeItem.id, "photoUrls", urls)}
                  maxPhotos={4}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
