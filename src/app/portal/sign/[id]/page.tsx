"use client";

import { useState, useEffect, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, PenLine, RotateCcw, X } from "lucide-react";

interface Contract {
  id: string;
  title: string;
  body: string;
  splitPercent: number;
  status: string;
  expiresAt: string;
  consignor: { firstName: string; lastName: string };
  store: { name: string };
}

export default function SignContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`/api/contracts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setContract(d);
        setLoading(false);
      });
  }, [id]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPos.current) return;

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    setSigning(true);
    const signatureData = canvas.toDataURL("image/png");

    const res = await fetch(`/api/contracts/${id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureData }),
    });

    if (res.ok) {
      setSigned(true);
    } else {
      const data = await res.json();
      setError(data.error || "Signing failed");
    }
    setSigning(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <X className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Unable to load contract</h2>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (signed || contract?.status === "SIGNED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Agreement Signed</h2>
          <p className="text-gray-500 text-sm mt-2">
            Your consignment agreement with {contract?.store?.name} has been signed successfully.
          </p>
          <p className="text-gray-400 text-xs mt-4">You may close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-xs text-gray-500">{contract?.store?.name}</p>
          <h1 className="text-lg font-bold text-gray-900">{contract?.title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            For: {contract?.consignor?.firstName} {contract?.consignor?.lastName}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Contract body */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
            {contract?.body}
          </pre>
        </div>

        {/* Signature pad */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-900">Your Signature</h2>
            </div>
            {hasSignature && (
              <button
                onClick={clearSignature}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          <div
            className={`relative border-2 rounded-xl overflow-hidden ${
              hasSignature ? "border-indigo-300" : "border-dashed border-gray-300"
            }`}
          >
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-sm select-none">Draw your signature here</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={560}
              height={160}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>

          <p className="text-xs text-gray-400">
            By signing above, you agree to the terms of this consignment agreement.
            Your signature, IP address, and timestamp will be recorded.
          </p>

          <Button
            onClick={handleSign}
            disabled={!hasSignature || signing}
            className="w-full h-12 text-base gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            {signing ? "Signing..." : "Sign Agreement"}
          </Button>
        </div>
      </main>
    </div>
  );
}
