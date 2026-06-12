"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle, AlertCircle, Upload } from "lucide-react";
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

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setState("uploading");
    setErrorMsg("");

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to storage first
    let imageUrl: string | null = null;
    const form = new FormData();
    form.append("file", file);

    const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
    if (uploadRes.ok) {
      const { url } = await uploadRes.json();
      imageUrl = url;
      onPhotoUploaded?.(url);
    }

    // Analyze with AI
    setState("analyzing");

    let body: any;
    if (imageUrl) {
      body = { imageUrl };
    } else {
      // Fallback: send base64
      const base64 = await fileToBase64(file);
      body = { imageBase64: base64, mimeType: file.type };
    }

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
                {state === "uploading" ? "Uploading photo..." : "AI analyzing item..."}
              </p>
              <p className="text-xs text-indigo-400">This takes 5–10 seconds</p>
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
                onClick={(e) => { e.stopPropagation(); setState("idle"); setPreview(null); }}
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
