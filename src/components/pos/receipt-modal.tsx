"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Printer, X } from "lucide-react";

interface ReceiptModalProps {
  sale: any;
  storeName?: string;
  onClose: () => void;
}

export function ReceiptModal({ sale, storeName = "ConsignPro", onClose }: ReceiptModalProps) {
  const printReceipt = () => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;

    const items = sale.items || [];
    const rows = items
      .map(
        (si: any) => `
        <tr>
          <td style="padding:4px 0;font-size:13px;">${si.item?.title || "Item"}</td>
          <td style="padding:4px 0;font-size:13px;text-align:right;">${formatCurrency(si.price)}</td>
        </tr>`
      )
      .join("");

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 8mm; }
          body { font-family: monospace; font-size: 13px; color: #111; margin: 0; }
          .store { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 4px; }
          .sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          .divider { border-top: 1px dashed #ccc; margin: 8px 0; }
          .total-row { font-weight: bold; font-size: 15px; }
          .footer { text-align: center; font-size: 11px; color: #888; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="store">${storeName}</div>
        <div class="sub">${new Date(sale.createdAt).toLocaleString()}</div>
        <div class="divider"></div>
        <table>
          <tbody>${rows}</tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tbody>
            <tr><td>Subtotal</td><td style="text-align:right;">${formatCurrency(sale.subtotal)}</td></tr>
            ${sale.discountAmount > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${formatCurrency(sale.discountAmount)}</td></tr>` : ""}
            <tr><td>Tax</td><td style="text-align:right;">${formatCurrency(sale.taxAmount)}</td></tr>
            <tr class="total-row"><td>TOTAL</td><td style="text-align:right;">${formatCurrency(sale.total)}</td></tr>
            <tr><td style="font-size:11px;color:#666;">${sale.paymentMethod?.replace("_", " ") || ""}</td></tr>
          </tbody>
        </table>
        <div class="footer">Thank you for shopping with us!<br/>Sale #${sale.id?.slice(-8)}</div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  if (!sale) return null;

  return (
    <Modal open={!!sale} onClose={onClose} title="Sale Receipt" className="max-w-sm">
      <div className="space-y-4">
        <div className="text-center pb-2 border-b border-gray-200">
          <p className="font-bold text-gray-900">{storeName}</p>
          <p className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleString()}</p>
        </div>

        <div className="space-y-1">
          {(sale.items || []).map((si: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-700 truncate flex-1">{si.item?.title || "Item"}</span>
              <span className="text-gray-900 font-medium ml-4">{formatCurrency(si.price)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span>-{formatCurrency(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Tax</span><span>{formatCurrency(sale.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
            <span>Total</span><span>{formatCurrency(sale.total)}</span>
          </div>
          <p className="text-xs text-gray-400 text-center pt-1">
            {sale.paymentMethod?.replace("_", " ")} · #{sale.id?.slice(-8)}
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={printReceipt} className="flex-1 gap-2">
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
