"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { FileText, Send, Plus, CheckCircle, Clock, Eye } from "lucide-react";

interface Contract {
  id: string;
  title: string;
  status: string;
  splitPercent: number;
  createdAt: string;
  signedAt?: string;
  consignor: { firstName: string; lastName: string; email?: string };
}

interface Consignor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  splitPercent: number;
  contractSignedAt?: string;
}

const statusColors: Record<string, "success" | "warning" | "info" | "default" | "danger"> = {
  SIGNED: "success",
  SENT: "warning",
  DRAFT: "default",
  EXPIRED: "danger",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewContract, setViewContract] = useState<any>(null);

  // Create form
  const [selectedConsignorId, setSelectedConsignorId] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = async () => {
    const [cRes, consRes] = await Promise.all([
      fetch("/api/contracts"),
      fetch("/api/consignors"),
    ]);
    const cData = await cRes.json();
    const consData = await consRes.json();
    setContracts(cData.contracts || []);
    setConsignors(consData.consignors || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!selectedConsignorId) { setCreateError("Select a consignor"); return; }
    setCreating(true);
    setCreateError("");

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consignorId: selectedConsignorId, sendEmail }),
    });

    const data = await res.json();
    if (!res.ok) { setCreateError(data.error || "Failed"); setCreating(false); return; }

    setCreateOpen(false);
    setSelectedConsignorId("");
    setCreating(false);
    load();
  };

  const signed = contracts.filter((c) => c.status === "SIGNED").length;
  const pending = contracts.filter((c) => c.status === "SENT").length;

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={[{ label: "Items", href: "/inventory" }, { label: "Contracts", href: "/contracts" }, { label: "Admin", href: "/admin" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Contracts</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">
            {signed} signed · {pending} awaiting signature · {contracts.length} total
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Signed</p>
              <p className="text-2xl font-bold text-green-700">{signed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Awaiting</p>
              <p className="text-2xl font-bold text-yellow-700">{pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
              <p className="text-2xl font-bold text-gray-900">{contracts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No contracts yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first consignment agreement</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Consignor</th>
                <th className="text-left p-4 font-medium text-gray-600">Agreement</th>
                <th className="text-center p-4 font-medium text-gray-600">Split</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Date</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{c.consignor.firstName} {c.consignor.lastName}</p>
                    <p className="text-xs text-gray-500">{c.consignor.email}</p>
                  </td>
                  <td className="p-4 text-gray-700">{c.title}</td>
                  <td className="p-4 text-center">
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                      {c.splitPercent}%
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge variant={statusColors[c.status]}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {c.status === "SIGNED" && c.signedAt
                      ? `Signed ${formatDate(c.signedAt)}`
                      : formatDate(c.createdAt)}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={async () => {
                        const r = await fetch(`/api/contracts/${c.id}`);
                        setViewContract(await r.json());
                      }}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create contract modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Consignment Agreement" className="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Consignor</label>
            <select
              value={selectedConsignorId}
              onChange={(e) => setSelectedConsignorId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a consignor...</option>
              {consignors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.splitPercent}% split)
                  {c.contractSignedAt ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800 font-medium mb-1">Contract Contents</p>
            <p className="text-xs text-blue-700">
              A standard consignment agreement will be generated with the consignor's name, your store name, and their split percentage.
              You can customize the contract template in Settings.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Send signing link via email</span>
              <p className="text-xs text-gray-500">Consignor will receive an email with a link to review and sign</p>
            </div>
          </label>

          {createError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{createError}</p>
          )}

          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={creating} className="flex-1 gap-2">
              <Send className="h-4 w-4" />
              {creating ? "Creating..." : sendEmail ? "Create & Send" : "Create Draft"}
            </Button>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* View contract modal */}
      {viewContract && (
        <Modal open={!!viewContract} onClose={() => setViewContract(null)} title={viewContract.title} className="max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={statusColors[viewContract.status]}>{viewContract.status}</Badge>
              {viewContract.status === "SIGNED" && viewContract.signedAt && (
                <p className="text-xs text-gray-500">Signed {new Date(viewContract.signedAt).toLocaleString()}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-5 max-h-72 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {viewContract.body}
              </pre>
            </div>
            {viewContract.signatureData && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Signature</p>
                <div className="border border-gray-200 rounded-xl p-3 bg-white inline-block">
                  <img src={viewContract.signatureData} alt="Signature" className="max-h-20" />
                </div>
                <p className="text-xs text-gray-400 mt-1">IP: {viewContract.signerIp}</p>
              </div>
            )}
            {viewContract.status !== "SIGNED" && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600 font-medium">Signing link:</p>
                <p className="text-xs text-indigo-600 font-mono mt-0.5 break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/portal/sign/{viewContract.id}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
