"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import JsBarcode from "jsbarcode";

interface LabelData {
  title: string;
  sku: string;
  price: number;
  size?: string;
  condition?: string;
  brand?: string;
  barcode?: string | null;
}

// Render a real, scannable Code128 barcode as an SVG string.
function barcodeSvg(value: string): string {
  try {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(el, value, { format: "CODE128", displayValue: false, width: 1.3, height: 32, margin: 0 });
    return new XMLSerializer().serializeToString(el);
  } catch {
    return "";
  }
}

export function printLabel(item: LabelData) {
  const win = window.open("", "_blank", "width=400,height=300");
  if (!win) return;

  const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.price);
  const code = (item.barcode && item.barcode.trim()) || item.sku;
  const svg = barcodeSvg(code);

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Label: ${item.sku}</title>
      <style>
        @page { size: 2in 1in; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 2in; height: 1in;
          font-family: Arial, Helvetica, sans-serif;
          padding: 4pt;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .title { font-size: 8pt; font-weight: bold; line-height: 1.2; }
        .meta { font-size: 7pt; color: #444; }
        .bottom { display: flex; justify-content: space-between; align-items: flex-end; }
        .price { font-size: 16pt; font-weight: bold; }
        .sku { font-size: 6pt; color: #666; font-family: monospace; }
        .barcode { text-align: center; }
        .barcode svg { width: 100%; height: 30px; }
        .code-text { font-size: 6pt; font-family: monospace; text-align: center; letter-spacing: 1px; }
      </style>
    </head>
    <body>
      <div>
        <div class="title">${item.title.slice(0, 40)}</div>
        <div class="meta">
          ${[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div class="barcode">${svg}</div>
      <div class="code-text">${code}</div>
      <div class="bottom">
        <div>
          <div class="price">${price}</div>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.close();
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

interface PrintLabelButtonProps {
  item: LabelData;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}

export function PrintLabelButton({ item, variant = "outline", size = "sm" }: PrintLabelButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => printLabel(item)}
      type="button"
    >
      <Printer className="h-3.5 w-3.5 mr-1.5" />
      Print Label
    </Button>
  );
}
