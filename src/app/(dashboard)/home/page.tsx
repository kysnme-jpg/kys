"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart, Package, Users, UserCircle, DollarSign, TrendingUp,
  MessageCircle, MessagesSquare, Megaphone, Mail, Tag, Shield, Bell,
} from "lucide-react";

interface Me {
  displayName: string; role: string; permissions: string[];
  unreadExternal?: number; unreadInternal?: number;
}

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", associate: "Employee", inventory_clerk: "Inventory clerk" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setMe(d); }); }, []);

  const can = (p: string) => !!me?.permissions?.includes(p);
  const isOwner = me?.role === "owner";

  const tiles = [
    { href: "/pos", label: "New sale", icon: ShoppingCart, show: true, accent: true },
    { href: "/inventory", label: "Inventory", icon: Package, show: true },
    { href: "/consignors", label: "Consignors", icon: Users, show: true },
    { href: "/customers", label: "Customers", icon: UserCircle, show: true },
    { href: "/payouts", label: "Payouts", icon: DollarSign, show: true },
    { href: "/insights", label: "Insights", icon: TrendingUp, show: true },
    { href: "/messages", label: "Messages", icon: MessageCircle, show: can("external_comms"), badge: me?.unreadExternal },
    { href: "/team", label: "Team chat", icon: MessagesSquare, show: can("internal_comms"), badge: me?.unreadInternal },
    { href: "/announcements", label: "Announcements", icon: Megaphone, show: true },
    { href: "/content", label: "Manage content", icon: Megaphone, show: can("content_admin") },
    { href: "/email", label: "Email blast", icon: Mail, show: can("content_admin") },
    { href: "/tags", label: "Tags", icon: Tag, show: can("content_admin") },
    { href: "/settings/staff", label: "Staff & roles", icon: Shield, show: isOwner },
    { href: "/settings/notifications", label: "Notifications", icon: Bell, show: me?.role === "owner" || me?.role === "manager" },
  ].filter((t) => t.show);

  return (
    <div className="px-11 pt-10 pb-6 max-[767px]:px-5 max-[767px]:pt-7">
      <div className="mb-7">
        <h1 className="font-serif text-[36px] sm:text-[44px] leading-none text-ink">{greeting()}{me?.displayName ? `, ${me.displayName.split(" ")[0]}` : ""}</h1>
        {me && <p className="text-[15px] text-[var(--muted)] mt-2">Signed in as <span className="font-semibold text-ink">{ROLE_LABEL[me.role] || me.role}</span></p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}
              className={`relative rounded-3xl border-[1.5px] p-5 flex flex-col gap-3 transition-colors ${t.accent ? "bg-accent text-[var(--accent-ink)] border-accent" : "bg-surface border-line hover:bg-chip text-ink"}`}>
              <Icon className={`h-7 w-7 ${t.accent ? "" : "text-accent"}`} strokeWidth={1.75} />
              <span className="font-semibold text-[16px]">{t.label}</span>
              {typeof t.badge === "number" && t.badge > 0 && (
                <span className="absolute top-3 right-3 bg-accent text-[var(--accent-ink)] text-[12px] font-bold rounded-full min-w-6 h-6 px-2 grid place-items-center border-2 border-surface">{t.badge}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
