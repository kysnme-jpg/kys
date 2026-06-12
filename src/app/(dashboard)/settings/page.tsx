"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Store, CreditCard, Globe, Tag, Key, Webhook, Copy, Trash2, Plus, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [addingCat, setAddingCat] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");

  // Webhooks
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["sale.created"]);
  const [addingWebhook, setAddingWebhook] = useState(false);

  const ALL_EVENTS = ["sale.created", "sale.refunded", "payout.created", "item.created", "item.sold", "consignor.created", "contract.signed"];

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
    fetch("/api/keys").then((r) => r.json()).then((d) => setApiKeys(d.keys || []));
    fetch("/api/webhooks/register").then((r) => r.json()).then((d) => setWebhooks(d.endpoints || []));
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKeyValue(data.key);
      setNewKeyName("");
      const keysRes = await fetch("/api/keys");
      const keysData = await keysRes.json();
      setApiKeys(keysData.keys || []);
    }
    setCreatingKey(false);
  };

  const deleteKey = async (id: string) => {
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const addWebhook = async () => {
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0) return;
    setAddingWebhook(true);
    const res = await fetch("/api/webhooks/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newWebhookUrl.trim(), events: newWebhookEvents }),
    });
    const data = await res.json();
    if (res.ok) {
      setWebhooks((prev) => [...prev, data]);
      setNewWebhookUrl("");
      setNewWebhookEvents(["sale.created"]);
    }
    setAddingWebhook(false);
  };

  const deleteWebhook = async (id: string) => {
    await fetch(`/api/webhooks/register?id=${id}`, { method: "DELETE" });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

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

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Use API keys to integrate with external systems. Keys are shown once at creation — store them securely.
          </p>

          {newKeyValue && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="text-xs font-medium text-green-800 mb-1">New key created — copy it now, it won't be shown again:</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-green-900 flex-1 break-all">{newKeyValue}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(newKeyValue); }}
                  className="text-green-700 hover:text-green-900 flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Shopify integration)"
              onKeyDown={(e) => e.key === "Enter" && createKey()}
            />
            <Button onClick={createKey} disabled={creatingKey} className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              {creatingKey ? "Creating..." : "Create Key"}
            </Button>
          </div>

          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs font-mono text-gray-500">{k.prefix}••••••••</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={k.active ? "success" : "default"}>{k.active ? "Active" : "Revoked"}</Badge>
                  <button onClick={() => deleteKey(k.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {apiKeys.length === 0 && (
              <p className="text-sm text-gray-500">No API keys yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Receive real-time POST notifications when events occur in your store.
          </p>

          <div className="space-y-3">
            <Input
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
            />
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Events to subscribe:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWebhookEvents.includes(ev)}
                      onChange={(e) => {
                        setNewWebhookEvents((prev) =>
                          e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)
                        );
                      }}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span className="text-xs font-mono text-gray-700">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={addWebhook} disabled={addingWebhook} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              {addingWebhook ? "Adding..." : "Add Endpoint"}
            </Button>
          </div>

          <div className="space-y-2">
            {webhooks.map((w) => (
              <div key={w.id} className="py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-gray-900 truncate">{w.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(w.events as string[]).map((ev) => (
                        <span key={ev} className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deleteWebhook(w.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {webhooks.length === 0 && (
              <p className="text-sm text-gray-500">No webhook endpoints configured</p>
            )}
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
