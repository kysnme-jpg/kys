"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrintKysTagButton } from "@/components/inventory/label-print";
import { formatCurrency } from "@/lib/utils";
import { Camera, Check, Loader2, X, Sparkles, RotateCcw, ImagePlus, ArrowLeft } from "lucide-react";

interface Consignor { id: string; firstName: string; lastName: string; splitPercent: number; }

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const EMPTY = { title: "", brand: "", size: "", color: "", condition: "Good", description: "", price: "" };

export default function IntakePage() {
  const router = useRouter();
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [consignorId, setConsignorId] = useState("");
  const [split, setSplit] = useState("");
  const [locked, setLocked] = useState(false);

  const [phase, setPhase] = useState<"idle" | "working" | "review">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [aiNote, setAiNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<any[]>([]);

  const camRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/consignors").then((r) => r.json()).then((d) => {
      const list: Consignor[] = d.consignors || [];
      setConsignors(list);
      const pid = new URLSearchParams(window.location.search).get("consignorId");
      if (pid) {
        const c = list.find((x) => x.id === pid);
        if (c) { setConsignorId(pid); setSplit(String(c.splitPercent)); setLocked(true); }
      }
    });
  }, []);

  const consignor = consignors.find((c) => c.id === consignorId);
  const setD = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const pickConsignor = (id: string) => {
    const c = consignors.find((x) => x.id === id);
    setConsignorId(id);
    setSplit(c ? String(c.splitPercent) : "");
  };

  const resetDraft = () => { setPhase("idle"); setPreview(null); setPhotoUrls([]); setDraft({ ...EMPTY }); setAiNote(""); };

  async function uploadPhoto(file: File): Promise<void> {
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: form });
      if (up.ok) { const { url } = await up.json(); setPhotoUrls((prev) => [...prev, url]); }
    } catch { /* keep going — a stored URL is nice-to-have, not required to save */ }
  }

  // First photo of an item: upload + run AI to auto-fill.
  const handlePhoto = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = (e) => setPreview(e.target?.result as string);
    rd.readAsDataURL(file);

    setPhase("working"); setAiNote("");
    await uploadPhoto(file);

    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/ai/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        const r = data.result;
        setDraft((d) => ({
          ...d,
          title: r.title || "",
          brand: r.brand || "",
          size: r.size || "",
          color: r.color || "",
          condition: CONDITIONS.includes(r.condition) ? r.condition : "Good",
          description: r.description || "",
          price: r.suggestedPrice != null ? String(r.suggestedPrice) : "",
        }));
      } else {
        setAiNote(data.error === "Anthropic API key not configured"
          ? "AI isn't configured yet — enter the details by hand."
          : "The AI couldn't read this photo — enter the details yourself.");
      }
    } catch {
      setAiNote("The AI couldn't read this photo — enter the details yourself.");
    }
    setPhase("review");
  };

  // Extra angle for the same item: upload only, no AI re-run.
  const handleMorePhoto = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    await uploadPhoto(file);
  };

  const canSave = draft.title.trim() && draft.price && parseFloat(draft.price) > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const payload: any = {
      title: draft.title.trim(),
      brand: draft.brand || undefined,
      size: draft.size || undefined,
      color: draft.color || undefined,
      condition: draft.condition || undefined,
      description: draft.description || undefined,
      price: parseFloat(draft.price),
      type: "CONSIGNED",
      consignorId: consignorId || undefined,
      splitPercent: split ? parseFloat(split) : undefined,
      photoUrls,
    };
    try {
      const res = await fetch("/api/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setAdded((a) => [{ ...saved, consignorName: consignor ? `${consignor.firstName} ${consignor.lastName}` : undefined }, ...a]);
        resetDraft();
        setTimeout(() => camRef.current?.focus(), 0);
      } else {
        const d = await res.json().catch(() => ({}));
        setAiNote(d.error || "Couldn't save — try again.");
      }
    } finally { setSaving(false); }
  };

  const consignorPayout = draft.price && split
    ? (parseFloat(draft.price) * parseFloat(split)) / 100 : null;

  return (
    <div className="px-11 pt-9 pb-16 max-[767px]:px-5 max-[767px]:pt-6">
      <button onClick={() => router.push("/inventory")} className="inline-flex items-center gap-2 text-[15px] font-medium text-[var(--muted)] hover:text-ink mb-3">
        <ArrowLeft className="h-4 w-4" /> Inventory
      </button>
      <h1 className="font-serif text-[40px] sm:text-[56px] leading-none text-ink mb-2">Quick intake</h1>
      <p className="text-[15px] font-medium text-[var(--muted)] mb-6">Snap a photo, let AI fill it in, confirm, and save — one item at a time.</p>

      {/* Consignor bar */}
      <div className="bg-surface border-[1.5px] border-line rounded-[22px] p-4 mb-5 flex items-center gap-3 flex-wrap">
        {locked && consignor ? (
          <>
            <div className="h-11 w-11 rounded-full bg-accent text-[var(--accent-ink)] flex items-center justify-center font-bold shrink-0">
              {(consignor.firstName[0] || "") + (consignor.lastName[0] || "")}
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-semibold text-ink truncate">Adding for {consignor.firstName} {consignor.lastName}</p>
              <p className="text-[13px] text-[var(--muted)]">{split}% consignor split · {added.length} added this session</p>
            </div>
            <button onClick={() => { setLocked(false); resetDraft(); }} className="ml-auto h-10 px-4 rounded-full border-[1.5px] border-line text-[14px] font-semibold text-ink hover:border-accent">Change</button>
          </>
        ) : (
          <>
            <span className="text-[15px] font-semibold text-ink">Consignor</span>
            <select value={consignorId} onChange={(e) => pickConsignor(e.target.value)}
              className="flex-1 min-w-[200px] h-12 rounded-full border-[1.5px] border-line bg-surface px-4 text-[16px] text-ink focus:outline-none focus:border-accent">
              <option value="">Select a consignor…</option>
              {consignors.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.splitPercent}% split)</option>)}
            </select>
            <button onClick={() => consignorId && setLocked(true)} disabled={!consignorId}
              className="h-12 px-6 rounded-full bg-accent text-[var(--accent-ink)] text-[16px] font-bold disabled:opacity-40">Start</button>
          </>
        )}
      </div>

      {/* Hidden camera inputs */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handlePhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={moreRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleMorePhoto(e.target.files?.[0]); e.target.value = ""; }} />

      {locked && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
          {/* Capture / review */}
          <div className="bg-surface border-[1.5px] border-line rounded-[28px] overflow-hidden">
            {phase === "idle" && (
              <button onClick={() => camRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-4 py-20 px-6 text-center hover:bg-chip transition-colors">
                <div className="h-20 w-20 rounded-full bg-accent text-[var(--accent-ink)] flex items-center justify-center"><Camera className="h-9 w-9" /></div>
                <div>
                  <p className="text-[22px] font-serif text-ink">Photograph the item</p>
                  <p className="text-[15px] text-[var(--muted)] mt-1">Tap to open the camera. AI reads the photo and fills in the details.</p>
                </div>
              </button>
            )}

            {phase === "working" && (
              <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
                {preview && <img src={preview} alt="" className="h-40 w-40 rounded-2xl object-cover" />}
                <div className="flex items-center gap-2 text-ink"><Loader2 className="h-5 w-5 animate-spin text-accent" /><span className="text-[16px] font-semibold">Reading the item…</span></div>
                <p className="text-[13px] text-[var(--muted)]">Uploading the photo and asking the AI — about 5–10 seconds.</p>
              </div>
            )}

            {phase === "review" && (
              <div className="p-5">
                <div className="flex gap-4 mb-4">
                  {preview && <img src={preview} alt="" className="h-28 w-28 rounded-2xl object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent mb-1.5"><Sparkles className="h-4 w-4" /> AI filled these in</div>
                    <label className="block text-[13px] font-medium text-[var(--muted)]">Title</label>
                    <input value={draft.title} onChange={(e) => setD("title", e.target.value)} placeholder="Item name"
                      className="w-full h-12 rounded-xl border-[1.5px] border-line bg-paper px-3 text-[17px] font-semibold text-ink focus:outline-none focus:border-accent" />
                  </div>
                </div>

                {aiNote && <div className="rounded-xl bg-[var(--chip)] text-[var(--muted)] text-[13px] px-3 py-2 mb-4">{aiNote}</div>}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--muted)] mb-1">Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[17px]">$</span>
                      <input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setD("price", e.target.value)} placeholder="0.00"
                        className="w-full h-12 rounded-xl border-[1.5px] border-line bg-paper pl-7 pr-3 text-[18px] font-bold text-ink focus:outline-none focus:border-accent" />
                    </div>
                    {consignorPayout != null && <p className="text-[12px] text-[var(--muted)] mt-1">Consignor gets {formatCurrency(consignorPayout)}</p>}
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--muted)] mb-1">Condition</label>
                    <select value={draft.condition} onChange={(e) => setD("condition", e.target.value)}
                      className="w-full h-12 rounded-xl border-[1.5px] border-line bg-paper px-3 text-[16px] text-ink focus:outline-none focus:border-accent">
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--muted)] mb-1">Brand</label>
                    <input value={draft.brand} onChange={(e) => setD("brand", e.target.value)} placeholder="—"
                      className="w-full h-11 rounded-xl border-[1.5px] border-line bg-paper px-3 text-[15px] text-ink focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--muted)] mb-1">Size</label>
                    <input value={draft.size} onChange={(e) => setD("size", e.target.value)} placeholder="—"
                      className="w-full h-11 rounded-xl border-[1.5px] border-line bg-paper px-3 text-[15px] text-ink focus:outline-none focus:border-accent" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[13px] font-medium text-[var(--muted)] mb-1">Description</label>
                  <textarea value={draft.description} onChange={(e) => setD("description", e.target.value)} rows={2} placeholder="Shown on the online shop"
                    className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent resize-none" />
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button onClick={() => moreRef.current?.click()} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full border-[1.5px] border-line text-[14px] font-semibold text-ink hover:border-accent"><ImagePlus className="h-4 w-4" /> Add angle</button>
                  {photoUrls.length > 1 && <span className="text-[13px] text-[var(--muted)]">{photoUrls.length} photos</span>}
                  <button onClick={() => camRef.current?.click()} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full border-[1.5px] border-line text-[14px] font-semibold text-ink hover:border-accent"><RotateCcw className="h-4 w-4" /> Retake</button>
                </div>

                <div className="flex gap-2">
                  <button onClick={save} disabled={!canSave}
                    className="flex-1 h-14 rounded-full bg-accent text-[var(--accent-ink)] text-[17px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition">
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    {saving ? "Saving…" : "Save & next item"}
                  </button>
                  <button onClick={resetDraft} className="h-14 px-5 rounded-full border-[1.5px] border-line text-[15px] font-semibold text-ink hover:border-accent">Discard</button>
                </div>
              </div>
            )}
          </div>

          {/* Session list */}
          <div className="bg-surface border-[1.5px] border-line rounded-[28px] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-[22px] text-ink">Added this session</h2>
              <span className="inline-flex items-center h-8 px-3 rounded-full bg-chip text-[var(--chip-ink)] text-[14px] font-semibold">{added.length}</span>
            </div>
            {added.length === 0 ? (
              <p className="text-[14px] text-[var(--muted)] py-6 text-center">Saved items will appear here. Print a KYS tag for each one.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {added.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 p-3 rounded-2xl bg-paper">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-ink truncate">{it.title}</p>
                      <p className="text-[13px] text-[var(--muted)]">{formatCurrency(it.price)} · {it.sku}</p>
                    </div>
                    <PrintKysTagButton item={{ ...it, consignor: it.consignorName }} size="sm" />
                  </div>
                ))}
              </div>
            )}
            {added.length > 0 && consignor && (
              <Link href={`/consignors/${consignorId}`} className="mt-4 inline-block text-[14px] font-semibold text-accent">View {consignor.firstName}'s items →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
