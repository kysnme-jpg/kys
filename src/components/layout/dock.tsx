"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Package, Users, ShoppingCart, DollarSign, TrendingUp, MoreHorizontal,
  Globe, Upload, Settings, LogOut, Sun, Moon, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "stock", label: "Stock", icon: Package, href: "/inventory", match: ["/inventory", "/contracts", "/admin"] },
  { key: "people", label: "People", icon: Users, href: "/customers", match: ["/customers", "/consignors"] },
  { key: "payouts", label: "Payouts", icon: DollarSign, href: "/payouts", match: ["/payouts"] },
  { key: "insights", label: "Insights", icon: TrendingUp, href: "/insights", match: ["/insights", "/reports"] },
];

export function Dock() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = (match: string[]) => match.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t-[1.5px] border-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex items-center justify-center gap-2.5 h-[96px] max-[767px]:h-[72px] px-3">
          <DockItem item={ITEMS[0]} active={active(ITEMS[0].match)} />
          <DockItem item={ITEMS[1]} active={active(ITEMS[1].match)} />

          {/* Center: New sale */}
          <Link
            href="/pos"
            className="inline-flex items-center justify-center gap-2 h-16 rounded-full bg-accent text-[var(--accent-ink)] font-bold text-[18px] px-[34px] mx-[18px] active:scale-[.98] transition-transform max-[767px]:px-6 max-[767px]:text-[16px]"
          >
            <ShoppingCart className="h-6 w-6" strokeWidth={2} />
            <span className="max-[480px]:hidden">New sale</span>
          </Link>

          <DockItem item={ITEMS[2]} active={active(ITEMS[2].match)} />
          <DockItem item={ITEMS[3]} active={active(ITEMS[3].match)} />

          {/* More */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-[108px] h-[72px] rounded-[18px] transition-colors max-[767px]:w-16",
              moreOpen ? "bg-ink text-[var(--panel-ink)]" : "text-[var(--muted)] hover:bg-chip"
            )}
          >
            <MoreHorizontal className="h-6 w-6" strokeWidth={1.75} />
            <span className="text-[14px] font-semibold max-[767px]:hidden">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}

function DockItem({ item, active }: { item: (typeof ITEMS)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-[108px] h-[72px] rounded-[18px] transition-colors max-[767px]:w-16",
        active ? "bg-ink text-[var(--panel-ink)] dark:bg-surface dark:text-ink" : "text-[var(--muted)] hover:bg-chip"
      )}
    >
      <Icon className="h-6 w-6" strokeWidth={1.75} />
      <span className={cn("text-[14px] font-semibold", !active && "max-[767px]:hidden")}>{item.label}</span>
    </Link>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try { setDark(document.documentElement.classList.contains("dark")); } catch {}
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleTheme = () => {
    const next = !dark; setDark(next);
    try { document.documentElement.classList.toggle("dark", next); localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  const Row = ({ icon: Icon, label, onClick, href, danger }: any) => {
    const cls = cn("flex items-center gap-3.5 w-full h-16 px-4 rounded-2xl text-[17px] font-semibold hover:bg-chip transition-colors", danger ? "text-[var(--danger-ink)]" : "text-ink");
    const inner = <><Icon className="h-6 w-6" strokeWidth={1.75} /> {label}</>;
    if (href) return <Link href={href} target={href === "/shop" ? "_blank" : undefined} className={cls} onClick={onClose}>{inner}</Link>;
    return <button className={cls} onClick={onClick}>{inner}</button>;
  };

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 animate-in fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1/2 -translate-x-1/2 bottom-[112px] w-[min(420px,calc(100vw-32px))] bg-surface border-[1.5px] border-line rounded-[28px] p-3 shadow-[0_8px_24px_rgba(60,40,20,.12)] animate-in fade-in slide-in-from-bottom-2 max-[767px]:bottom-[84px]"
      >
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="font-serif text-[22px] text-ink">More</span>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-chip" aria-label="Close"><X className="h-5 w-5 text-[var(--muted)]" /></button>
        </div>
        <Row icon={Globe} label="Online Shop" href="/shop" />
        <Row icon={Upload} label="Import" href="/import" />
        <Row icon={Settings} label="Settings" href="/settings" />
        <Row icon={dark ? Sun : Moon} label={dark ? "Light mode" : "Dark mode"} onClick={toggleTheme} />
        <div className="h-px bg-line-soft my-1 mx-2" />
        <Row icon={LogOut} label="Sign out" danger onClick={() => signOut({ callbackUrl: "/login" })} />
      </div>
    </div>
  );
}
