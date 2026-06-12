import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function generateSKU(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function calcConsignorCredit(price: number, splitPercent: number): number {
  return parseFloat(((price * splitPercent) / 100).toFixed(2));
}

export function calcStoreFee(price: number, splitPercent: number): number {
  return parseFloat((price - calcConsignorCredit(price, splitPercent)).toFixed(2));
}
