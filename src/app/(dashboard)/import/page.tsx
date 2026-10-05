"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, Loader2, Users, Package, AlertTriangle } from "lucide-react";

export default function ImportPage() {
  const [data, setData] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(""); setResult(null); setData(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed?.consignors)) {
        setError("That file doesn't look right — it should contain a list of consignors.");
        return;
      }
      setData(parsed);
    } catch {
      setError("Couldn't read that file. Make sure it's the import file (.json).");
    }
  };

  const consignorCount = data?.consignors?.length || 0;
  const itemCount = (data?.consignors || []).reduce((s: number, c: any) => s + (c.items?.length || 0), 0);

  const runImport = async () => {
    setImporting(true); setError("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const d = await res.json();
    setImporting(false);
    if (!res.ok) { setError(d.error || "Import failed."); return; }
    setResult(d);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload the prepared import file to add your consignors and their items in one step.
        </p>
      </div>

      {result ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Import complete!</h2>
            <p className="text-gray-600 mt-2">
              Added <b>{result.createdConsignors}</b> consignors and <b>{result.createdItems}</b> items.
              {result.skippedItems > 0 && <> ({result.skippedItems} already existed and were skipped.)</>}
            </p>
            <div className="flex gap-3 justify-center mt-5">
              <a href="/consignors"><Button>View Consignors</Button></a>
              <a href="/inventory"><Button variant="outline">View Inventory</Button></a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Choose file</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-400 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">{fileName || "Click to select the import file (.json)"}</span>
                <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
              </label>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}
            </CardContent>
          </Card>

          {data && (
            <Card>
              <CardHeader><CardTitle>Ready to import</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
                    <Users className="h-6 w-6 text-indigo-600" />
                    <div><p className="text-2xl font-bold text-gray-900">{consignorCount}</p><p className="text-xs text-gray-500">Consignors</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                    <Package className="h-6 w-6 text-green-600" />
                    <div><p className="text-2xl font-bold text-gray-900">{itemCount}</p><p className="text-xs text-gray-500">Items</p></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Consignors are matched by email — anyone already in your system won&apos;t be duplicated, and items
                  that already exist are skipped. Items import as Active, priced from the sheet, with a 50% split.
                </p>
                <Button onClick={runImport} disabled={importing} className="w-full h-11 gap-2">
                  {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : `Import ${consignorCount} consignors & ${itemCount} items`}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
