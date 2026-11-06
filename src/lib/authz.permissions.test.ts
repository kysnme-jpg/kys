import { describe, it, expect } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, roleHasPermission, DB_ROLE_TO_INTERNAL } from "./authz.permissions";

describe("RBAC permission map", () => {
  it("owner has every permission", () => {
    const all = Object.values(PERMISSIONS);
    for (const p of all) expect(roleHasPermission("owner", p)).toBe(true);
  });

  it("only owner holds OWNER_ONLY", () => {
    expect(roleHasPermission("owner", PERMISSIONS.OWNER_ONLY)).toBe(true);
    for (const role of ["manager", "associate", "inventory_clerk", "consignor", "customer"] as const) {
      expect(roleHasPermission(role, PERMISSIONS.OWNER_ONLY)).toBe(false);
    }
  });

  it("external roles hold NO staff permissions (isolation)", () => {
    for (const role of ["consignor", "customer"] as const) {
      expect(ROLE_PERMISSIONS[role]).toHaveLength(0);
      for (const p of Object.values(PERMISSIONS)) expect(roleHasPermission(role, p)).toBe(false);
    }
  });

  it("inventory_clerk can use internal comms but not external comms", () => {
    expect(roleHasPermission("inventory_clerk", PERMISSIONS.INTERNAL_COMMS)).toBe(true);
    expect(roleHasPermission("inventory_clerk", PERMISSIONS.EXTERNAL_COMMS)).toBe(false);
  });

  it("maps the DB role enum to internal roles", () => {
    expect(DB_ROLE_TO_INTERNAL.OWNER).toBe("owner");
    expect(DB_ROLE_TO_INTERNAL.MANAGER).toBe("manager");
    expect(DB_ROLE_TO_INTERNAL.EMPLOYEE).toBe("associate");
  });
});
