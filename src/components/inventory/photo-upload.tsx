"use client";

import { useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
}

export function PhotoUpload({ value, onChange, maxPhotos = 6 }: PhotoUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const uploadFile = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Upload failed");
      return null;
    }
    return data.url;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = maxPhotos - value.length;
      const toUpload = fileArray.slice(0, remaining);

      if (toUpload.length === 0) return;

      setUploading(true);
      setError("");

      const urls = await Promise.all(toUpload.map(uploadFile));
      const validUrls = urls.filter(Boolean) as string[];
      onChange([...value, ...validUrls]);
      setUploading(false);
    },
    [value, onChange, maxPhotos]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removePhoto = (url: string) => {
    onChange(value.filter((u) => u !== url));
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {value.length < maxPhotos && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
          )}
          onClick={() => document.getElementById("photo-file-input")?.click()}
        >
          <input
            id="photo-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-indigo-600">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Uploading photos...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">Drop photos here or click to browse</p>
              <p className="text-xs text-gray-400">JPEG, PNG, WEBP · Max 10MB each · {maxPhotos - value.length} remaining</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Photo grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {value.map((url, i) => (
            <div key={url} className="relative aspect-square group">
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover rounded-lg border border-gray-200"
              />
              {i === 0 && (
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  Main
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {value.length < maxPhotos && uploading && (
            <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
      )}

      {value.length === 0 && !uploading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <ImageIcon className="h-4 w-4" />
          <span>No photos added yet</span>
        </div>
      )}
    </div>
  );
}
