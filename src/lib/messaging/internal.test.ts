import { describe, it, expect } from "vitest";
import { listDirectory, unreadCountInternal } from "@/lib/messaging/internal";
import type { Actor } from "@/lib/authz";

const consignor: Actor = { class: "EXTERNAL", role: "consignor", consignorId: "c1", storeId: "s1", displayName: "K", permissions: new Set() };

describe("internal messaging isolation (§4a)", () => {
  it("rejects an EXTERNAL actor before any data access", async () => {
    await expect(listDirectory(consignor)).rejects.toThrow(/staff only/i);
  });

  it("reports zero unread for a non-internal actor (no leak, no DB)", async () => {
    await expect(unreadCountInternal(consignor)).resolves.toBe(0);
  });
});
