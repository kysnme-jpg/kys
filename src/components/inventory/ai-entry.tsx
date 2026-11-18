"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle, AlertCircle, Upload, Globe, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIResult {
  title?: string;
  brand?: string;
  category?: string;
  condition?: string;
  size?: string;
  color?: string;
  description?: string;
  suggestedPrice?: number;
  keywords?: string[];
}

interface AIEntryProps {
  onResult: (result: AIResult) => void;
  onPhotoUploaded?: (url: string) => void;
}

export function AIEntry({ onResult, onPhotoUploaded }: AIEntryProps) {
  const [state, setState] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  // Online lookup is a per-device choice shared with Quick Intake.
  const [lookupOnline, setLookupOnline] = useState(false);
  const [sources, setSources] = useState<{ title: string; url: string }[]>([]);
  const [lookupMissed, setLookupMissed] = useState(false);
  useEffect(() => { try { setLookupOnline(localStorage.getItem("intake.lookupOnline") === "1"); } catch {} }, []);
  const toggleLookup = (on: boolean) => { setLookupOnline(on); try { localStorage.setItem("intake.lookupOnline", on ? "1" : "0"); } catch {} };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setState("uploading");
    setErrorMsg("");
    setSources([]);
    setLookupMissed(false);

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to storage first (for the stored photo URL)
    const form = new FormData();
    form.append("file", file);

    const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
    if (uploadRes.ok) {
      const { url } = await uploadRes.json();
      onPhotoUploaded?.(url);
    }

    // Analyze with AI
    setState("analyzing");

    // Send the raw image as base64 so analysis works regardless of where the
    // photo is stored — volume-served URLs aren't publicly fetchable by the AI provider.
    const base64 = await fileToBase64(file);
    const body = { imageBase64: base64, mimeType: file.type, lookup: lookupOnline };

    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.result) {
      setState("error");
      setErrorMsg(data.error || "AI analysis failed");
      return;
    }

    setState("done");
    setSources(data.lookup?.sources ?? []);
    setLookupMissed(!!data.lookup?.failed);
    onResult(data.result);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone / trigger */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
          state === "idle" && "border-indigo-300 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100",
          state === "uploading" || state === "analyzing" ? "border-indigo-400 bg-indigo-50" : "",
          state === "done" && "border-green-300 bg-green-50",
          state === "error" && "border-red-300 bg-red-50"
        )}
        onClick={() => state === "idle" && document.getElementById("ai-entry-input")?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <input
          id="ai-entry-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="flex flex-col items-center gap-2">
          {state === "idle" && (
            <>
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-sm font-semibold text-indigo-700">AI Item Entry</p>
              <p className="text-xs text-indigo-500">Drop a photo or click to auto-fill item details</p>
            </>
          )}
          {(state === "uploading" || state === "analyzing") && (
            <>
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-indigo-700">
                {state === "uploading" ? "Uploading photo..." : lookupOnline ? "Looking it up online..." : "AI analyzing item..."}
              </p>
              <p className="text-xs text-indigo-400">{lookupOnline ? "This takes about 30–60 seconds" : "This takes about 10–20 seconds"}</p>
            </>
          )}
          {state === "done" && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium text-green-700">Fields auto-filled!</p>
              <p className="text-xs text-green-500">Review and adjust below, then save</p>
              <button
                type="button"
                className="text-xs text-green-600 underline mt-1"
                onClick={(e) => { e.stopPropagation(); setState("idle"); setPreview(null); setSources([]); setLookupMissed(false); }}
              >
                Try another photo
              </button>
            </>
          )}
          {state === "error" && (
            <>
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm font-medium text-red-700">Analysis failed</p>
              <p className="text-xs text-red-500">{errorMsg}</p>
              <button
                type="button"
                className="text-xs text-red-600 underline mt-1"
                onClick={(e) => { e.stopPropagation(); setState("idle"); }}
              >
                Try again
              </button>
            </>
          )}
        </div>

        {preview && (state === "done" || state === "analyzing") && (
          <img
            src={preview}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-10"
          />
        )}
      </div>

      {state === "idle" && (
        <label className="flex items-start gap-2.5 text-left cursor-pointer select-none">
          <input type="checkbox" checked={lookupOnline} onChange={(e) => toggleLookup(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800"><Globe className="h-3.5 w-3.5 text-indigo-600" /> Look it up online</span>
            <span className="block text-xs text-gray-500">Confirms the exact style, materials and retail price on the web. Slower (about 30–60 seconds) and costs a little more.</span>
          </span>
        </label>
      )}

      {state === "done" && lookupMissed && (
        <p className="text-xs text-gray-500">The online lookup didn&apos;t find anything to go on, so these details are from the photo alone.</p>
      )}

      {state === "done" && sources.length > 0 && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700"><Globe className="h-3 w-3 text-indigo-600" /> Checked online</p>
          <ul className="mt-1 space-y-0.5">
            {sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline break-all">
                  {src.title} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
