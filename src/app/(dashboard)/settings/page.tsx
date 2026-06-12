"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Store, CreditCard, Globe, Tag } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    setAddingCat(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setCategories((prev) => [...prev, data]);
      setCategoryName("");
    }
    setAddingCat(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Store Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
            <Input defaultValue="My Consign Shop" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" defaultValue="owner@myconsignshop.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input defaultValue="555-0100" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <Input type="number" step="0.01" defaultValue="8.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="USD">USD — US Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
          </div>
          <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Clover */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Clover Payment Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Connect your Clover merchant account to accept card payments in-store.
            Get your credentials from the <a href="https://www.clover.com/developers" target="_blank" rel="noopener" className="text-indigo-600 hover:underline">Clover Developer Dashboard</a>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
            <Input placeholder="Your Clover Merchant ID" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <Input type="password" placeholder="Your Clover REST API token" />
          </div>
          <Button variant="outline" className="gap-2">
            <Save className="h-4 w-4" />
            Save Clover Settings
          </Button>
        </CardContent>
      </Card>

      {/* Online Shop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Online Shop
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Your public shop is live at <span className="font-mono text-indigo-600">/shop</span>.
            Items marked "List on public online shop" will appear there automatically.
          </p>
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
            <p className="text-sm font-medium text-indigo-800">Shop URL</p>
            <p className="text-indigo-700 font-mono text-sm mt-0.5">
              {typeof window !== "undefined" ? window.location.origin : ""}/shop
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="New category name..."
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <Button onClick={addCategory} disabled={addingCat} variant="outline">
              {addingCat ? "Adding..." : "Add"}
            </Button>
          </div>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm">
                <span className="font-medium text-gray-800">{c.name}</span>
                <span className="text-gray-400 text-xs">{c._count?.items || 0} items</span>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-500">No categories yet — add one above</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
