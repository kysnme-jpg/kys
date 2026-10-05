"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Store, CreditCard, Globe, Tag, Key, Webhook, Copy, Trash2, Plus, Percent, FileText } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [addingCat, setAddingCat] = useState(false);

  // Store info
  const [store, setStore] = useState({ name: "", email: "", phone: "", taxRate: "", currency: "USD" });
  const [savingStore, setSavingStore] = useState(false);

  // Clover
  const [clover, setClover] = useState({ merchantId: "", apiKey: "", apiKeySet: false });
  const [savingClover, setSavingClover] = useState(false);
  const [cloverSaved, setCloverSaved] = useState(false);

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

  // Discount rules
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState({ name: "", type: "PERCENTAGE", value: "", code: "" });
  const [addingRule, setAddingRule] = useState(false);

  // Contract template
  const [contractTemplate, setContractTemplate] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const ALL_EVENTS = ["sale.created", "sale.refunded", "payout.created", "item.created", "item.sold", "consignor.created", "contract.signed"];

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
    fetch("/api/keys").then((r) => r.json()).then((d) => setApiKeys(d.keys || []));
    fetch("/api/webhooks/register").then((r) => r.json()).then((d) => setWebhooks(d.endpoints || []));
    fetch("/api/discount-rules").then((r) => r.json()).then((d) => setDiscountRules(d.rules || []));
    fetch("/api/store/template").then((r) => r.ok ? r.json() : null).then((d) => { if (d?.template) setContractTemplate(d.template); });
    fetch("/api/store").then((r) => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      setStore({
        name: d.name || "",
        email: d.email || "",
        phone: d.phone || "",
        taxRate: d.taxRate != null ? String((d.taxRate * 100).toFixed(2)) : "",
        currency: d.currency || "USD",
      });
      setClover({ merchantId: d.cloverMerchantId || "", apiKey: "", apiKeySet: !!d.cloverApiKeySet });
    });
  }, []);

  const saveStore = async () => {
    setSavingStore(true);
    const res = await fetch("/api/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: store.name,
        email: store.email || null,
        phone: store.phone || null,
        taxRate: store.taxRate ? parseFloat(store.taxRate) / 100 : undefined,
        currency: store.currency,
      }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSavingStore(false);
  };

  const saveClover = async () => {
    setSavingClover(true);
    const res = await fetch("/api/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cloverMerchantId: clover.merchantId || null,
        ...(clover.apiKey.trim() ? { cloverApiKey: clover.apiKey.trim() } : {}),
      }),
    });
    if (res.ok) {
      setCloverSaved(true);
      setTimeout(() => setCloverSaved(false), 2000);
      setClover((c) => ({ ...c, apiKey: "", apiKeySet: c.apiKeySet || !!c.apiKey.trim() }));
    }
    setSavingClover(false);
  };

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

  const addDiscountRule = async () => {
    if (!newRule.name || !newRule.value) return;
    setAddingRule(true);
    const res = await fetch("/api/discount-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRule),
    });
    const data = await res.json();
    if (res.ok) {
      setDiscountRules((prev) => [data, ...prev]);
      setNewRule({ name: "", type: "PERCENTAGE", value: "", code: "" });
    }
    setAddingRule(false);
  };

  const deleteRule = async (id: string) => {
    await fetch(`/api/discount-rules?id=${id}`, { method: "DELETE" });
    setDiscountRules((prev) => prev.filter((r) => r.id !== id));
  };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    await fetch("/api/store/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: contractTemplate }),
    });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
    setSavingTemplate(false);
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
            <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <Input type="number" step="0.01" value={store.taxRate} onChange={(e) => setStore({ ...store, taxRate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={store.currency}
                onChange={(e) => setStore({ ...store, currency: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="USD">USD — US Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
          </div>
          <Button onClick={saveStore} disabled={savingStore} className="gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : savingStore ? "Saving..." : "Save Changes"}
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
            <Input
              value={clover.merchantId}
              onChange={(e) => setClover({ ...clover, merchantId: e.target.value })}
              placeholder="Your Clover Merchant ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <Input
              type="password"
              value={clover.apiKey}
              onChange={(e) => setClover({ ...clover, apiKey: e.target.value })}
              placeholder={clover.apiKeySet ? "•••••••• (saved — type to replace)" : "Your Clover REST API token"}
            />
            {clover.apiKeySet && !clover.apiKey && (
              <p className="text-xs text-green-600 mt-1">An API key is saved. Leave blank to keep it.</p>
            )}
          </div>
          <Button variant="outline" onClick={saveClover} disabled={savingClover} className="gap-2">
            <Save className="h-4 w-4" />
            {cloverSaved ? "Saved!" : savingClover ? "Saving..." : "Save Clover Settings"}
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

      {/* Discount Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Discount Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Create percentage or fixed-amount discounts. Promo codes can be entered at checkout.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <Input
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g. Senior Discount"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newRule.type}
                onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Value ({newRule.type === "PERCENTAGE" ? "%" : "$"})
              </label>
              <Input
                type="number"
                min={0}
                step={newRule.type === "PERCENTAGE" ? 1 : 0.01}
                value={newRule.value}
                onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                placeholder={newRule.type === "PERCENTAGE" ? "10" : "5.00"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Promo Code (optional)</label>
              <Input
                value={newRule.code}
                onChange={(e) => setNewRule({ ...newRule, code: e.target.value.toUpperCase() })}
                placeholder="SAVE10"
              />
            </div>
          </div>
          <Button onClick={addDiscountRule} disabled={addingRule} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {addingRule ? "Adding..." : "Add Rule"}
          </Button>
          <div className="space-y-2">
            {discountRules.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">
                    {r.type === "PERCENTAGE" ? `${r.value}% off` : `$${r.value} off`}
                    {r.code && <span className="ml-2 font-mono bg-gray-200 px-1 rounded text-gray-700">{r.code}</span>}
                  </p>
                </div>
                <button onClick={() => deleteRule(r.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {discountRules.length === 0 && <p className="text-sm text-gray-500">No discount rules yet</p>}
          </div>
        </CardContent>
      </Card>

      {/* Contract Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Customize the default consignment agreement template. Use <code className="text-xs bg-gray-100 px-1 rounded">{"{{storeName}}"}</code>, <code className="text-xs bg-gray-100 px-1 rounded">{"{{consignorName}}"}</code>, and <code className="text-xs bg-gray-100 px-1 rounded">{"{{splitPercent}}"}</code> as placeholders.
          </p>
          <textarea
            value={contractTemplate}
            onChange={(e) => setContractTemplate(e.target.value)}
            rows={12}
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y"
            placeholder="Enter your custom contract template..."
          />
          <Button onClick={saveTemplate} disabled={savingTemplate} className="gap-2">
            <Save className="h-4 w-4" />
            {templateSaved ? "Saved!" : savingTemplate ? "Saving..." : "Save Template"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
