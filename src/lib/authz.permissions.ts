// Pure permission logic, split out so it can be unit-tested without importing
// Next.js / Prisma (which pull in server-only modules). authz.ts re-exports this.

export const PERMISSIONS = {
  OWNER_ONLY: "owner_only",
  EXTERNAL_COMMS: "external_comms",
  INTERNAL_COMMS: "internal_comms",
  CONTENT_ADMIN: "content_admin",
  EXPORT_ALL: "export_all",
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type InternalRole = "owner" | "manager" | "associate" | "inventory_clerk";
export type ExternalRole = "consignor" | "customer";
export type Role = InternalRole | ExternalRole;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [PERMISSIONS.OWNER_ONLY, PERMISSIONS.EXTERNAL_COMMS, PERMISSIONS.INTERNAL_COMMS, PERMISSIONS.CONTENT_ADMIN, PERMISSIONS.EXPORT_ALL],
  manager: [PERMISSIONS.EXTERNAL_COMMS, PERMISSIONS.INTERNAL_COMMS, PERMISSIONS.CONTENT_ADMIN],
  associate: [PERMISSIONS.EXTERNAL_COMMS, PERMISSIONS.INTERNAL_COMMS],
  inventory_clerk: [PERMISSIONS.INTERNAL_COMMS],
  consignor: [],
  customer: [],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

export const DB_ROLE_TO_INTERNAL: Record<string, InternalRole> = {
  OWNER: "owner",
  MANAGER: "manager",
  EMPLOYEE: "associate",
  ASSOCIATE: "associate",
  INVENTORY_CLERK: "inventory_clerk",
};
