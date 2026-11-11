import { db } from "@/lib/db";
import { ROLE_PERMISSIONS, type Permission, type InternalRole } from "@/lib/authz.permissions";

// Internal roles that get seeded into the RolePermission table per store.
const SEED_ROLES: InternalRole[] = ["owner", "manager", "associate", "inventory_clerk"];

// Avoid re-checking the DB on every request once a store is confirmed seeded.
const seededStores = new Set<string>();

/** Idempotently seed the default role→permission rows for a store (once). */
export async function ensureRolePermissionsSeeded(storeId: string): Promise<void> {
  if (seededStores.has(storeId)) return;
  try {
    const count = await db.rolePermission.count({ where: { storeId } });
    if (count === 0) {
      const rows = SEED_ROLES.flatMap((role) =>
        (ROLE_PERMISSIONS[role] || []).map((permission) => ({ storeId, role, permission }))
      );
      if (rows.length) await db.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
    seededStores.add(storeId);
  } catch {
    // Table not migrated yet, or transient error — fall back to defaults silently.
  }
}

/**
 * Permissions for a role in a store. Reads the DB table (editable source of
 * truth); if the store/role isn't seeded or the table is unavailable, falls
 * back to the static defaults so authorization never silently opens up or
 * hard-fails.
 */
export async function getPermissionsForRole(storeId: string, role: InternalRole): Promise<Set<Permission>> {
  try {
    await ensureRolePermissionsSeeded(storeId);
    const rows = await db.rolePermission.findMany({ where: { storeId, role }, select: { permission: true } });
    if (rows.length) return new Set(rows.map((r) => r.permission as Permission));
  } catch {
    // ignore — fall through to defaults
  }
  return new Set(ROLE_PERMISSIONS[role] || []);
}
