"use client";

import { Button } from "@/components/ui/button";
import { Printer, Tag } from "lucide-react";
import JsBarcode from "jsbarcode";
import { KYS_LOGO_DATA_URI } from "./kys-logo";

interface LabelData {
  title: string;
  sku: string;
  price: number;
  size?: string;
  condition?: string;
  brand?: string;
  barcode?: string | null;
  consignor?: string;
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

// Print many labels at once — one 2"x1" label per page.
export function printLabels(items: LabelData[]) {
  if (!items.length) return;
  if (items.length === 1) { printLabel(items[0]); return; }

  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;

  const pages = items.map((item) => {
    const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.price);
    const code = (item.barcode && item.barcode.trim()) || item.sku;
    const svg = barcodeSvg(code);
    return `
      <div class="label">
        <div>
          <div class="title">${item.title.slice(0, 40)}</div>
          <div class="meta">${[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}</div>
        </div>
        <div class="barcode">${svg}</div>
        <div class="code-text">${code}</div>
        <div class="bottom"><div class="price">${price}</div></div>
      </div>`;
  }).join("");

  win.document.write(`
    <!DOCTYPE html><html><head><title>Labels (${items.length})</title><style>
      @page { size: 2in 1in; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; }
      .label { width: 2in; height: 1in; padding: 4pt; display: flex; flex-direction: column;
        justify-content: space-between; page-break-after: always; overflow: hidden; }
      .title { font-size: 8pt; font-weight: bold; line-height: 1.2; }
      .meta { font-size: 7pt; color: #444; }
      .barcode { text-align: center; } .barcode svg { width: 100%; height: 30px; }
      .code-text { font-size: 6pt; font-family: monospace; text-align: center; letter-spacing: 1px; }
      .bottom { display: flex; justify-content: space-between; align-items: flex-end; }
      .price { font-size: 16pt; font-weight: bold; }
    </style></head><body>${pages}
    <script>window.onload=function(){window.print();window.close();};</script>
    </body></html>`);
  win.document.close();
}

// ─── Branded KYS hang tag (2" x 2") ──────────────────────────────────────────

// Shared CSS for the KYS tag.
const KYS_TAG_CSS = `
  .kys-tag { width: 2in; height: 2in; padding: 0.12in; display: flex; flex-direction: column;
    font-family: Georgia, 'Times New Roman', serif; overflow: hidden; }
  .kt-logo { text-align: center; flex: 0 0 auto; }
  .kt-logo img { height: 0.72in; max-width: 1.7in; object-fit: contain; }
  .kt-fields { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: 0.07in; font-size: 9pt; padding: 0 2pt; }
  .kt-sz { text-align: right; }
  .kt-pc { display: flex; justify-content: space-between; align-items: baseline; gap: 4pt; }
  .kt-price { font-weight: bold; font-size: 12pt; white-space: nowrap; }
  .kt-cons { font-size: 8pt; text-align: right; overflow: hidden; text-overflow: ellipsis; }
  .kt-v { border-bottom: 1px solid #000; padding: 0 3pt; min-width: 0.55in; display: inline-block; text-align: center; }
  .kt-barcode { text-align: center; flex: 0 0 auto; }
  .kt-barcode svg { width: 92%; height: 0.34in; }
  .kt-code { text-align: center; font-family: monospace; font-size: 6pt; letter-spacing: 1px; }
`;

function kysTagInner(item: LabelData): string {
  const code = (item.barcode && item.barcode.trim()) || item.sku;
  const svg = barcodeSvg(code);
  const priceNum = (item.price || 0).toFixed(2);
  return `
    <div class="kt-logo"><img src="${KYS_LOGO_DATA_URI}" alt="" /></div>
    <div class="kt-fields">
      <div class="kt-sz">Sz <span class="kt-v">${item.size || ""}</span></div>
      <div class="kt-pc">
        <span class="kt-price">$${priceNum}</span>
        <span class="kt-cons">${item.consignor ? `Consignor: ${item.consignor}` : ""}</span>
      </div>
    </div>
    <div class="kt-barcode">${svg}</div>
    <div class="kt-code">${code}</div>`;
}

// Print a single KYS tag (2" x 2").
export function printKysTag(item: LabelData) {
  const win = window.open("", "_blank", "width=360,height=360");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head><title>Tag: ${item.sku}</title><style>
      @page { size: 2in 2in; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Georgia, serif; }
      ${KYS_TAG_CSS}
    </style></head><body>
      <div class="kys-tag">${kysTagInner(item)}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close();},200);};</script>
    </body></html>`);
  win.document.close();
}

// Print many KYS tags laid out as a grid on letter-size cardstock (with faint
// cut guides). Great for printing a whole consignor's items on your own printer.
export function printKysTags(items: LabelData[]) {
  if (!items.length) return;
  const tags = items.map((item) => `<div class="kys-tag">${kysTagInner(item)}</div>`).join("");
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head><title>KYS Tags (${items.length})</title><style>
      @page { size: letter; margin: 0.3in; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Georgia, serif; }
      .sheet { display: flex; flex-wrap: wrap; gap: 0.12in; }
      .kys-tag { border: 1px dashed #c9c9c9; }
      ${KYS_TAG_CSS}
    </style></head><body>
      <div class="sheet">${tags}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};</script>
    </body></html>`);
  win.document.close();
}

export function PrintKysTagButton({ item, variant = "outline", size = "sm" }: PrintLabelButtonProps) {
  return (
    <Button variant={variant} size={size} onClick={() => printKysTag(item)} type="button">
      <Tag className="h-3.5 w-3.5 mr-1.5" />
      Print KYS Tag
    </Button>
  );
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
