import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { getPermissionsForRole } from "@/lib/rbac";
import type { InternalRole } from "@/lib/authz.permissions";

export const runtime = "nodejs";

const ROLE_LABELS: { role: InternalRole; label: string; blurb: string }[] = [
  { role: "owner", label: "Owner", blurb: "Full access, including staff, roles, exports and owner-only tools." },
  { role: "manager", label: "Manager", blurb: "Runs the floor: content, messaging, and day-to-day operations." },
  { role: "associate", label: "Employee", blurb: "Everyday staff: sell, manage inventory and talk to customers." },
  { role: "inventory_clerk", label: "Inventory clerk", blurb: "Focused on inventory and internal team messaging." },
];

const PERMISSION_LABELS: Record<string, string> = {
  owner_only: "Owner-only tools",
  external_comms: "Message customers & consignors",
  internal_comms: "Team chat",
  content_admin: "Manage content, tags & email blasts",
  export_all: "Export all store data",
};

// A read-only view of each staff role and what it can do (owner only).
export async function GET(req: NextRequest) {
  const g = await requireOwner(req);
  if (!g.ok) return g.res;

  const roles = await Promise.all(ROLE_LABELS.map(async (r) => {
    const perms = await getPermissionsForRole(g.actor.storeId, r.role);
    return {
      role: r.role, label: r.label, blurb: r.blurb,
      permissions: Array.from(perms).map((p) => ({ key: p, label: PERMISSION_LABELS[p] || p })),
    };
  }));

  return NextResponse.json({
    roles,
    identities: [
      { key: "staff", label: "Staff", blurb: "Your team — owners, managers, employees and clerks who run the store." },
      { key: "consignor", label: "Consignor", blurb: "People who consign items and use the consignor portal." },
      { key: "customer", label: "Customer", blurb: "Shoppers and loyalty members." },
    ],
  });
}
