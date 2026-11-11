import { describe, it, expect } from "vitest";
import { audienceIncludesActor, audienceOrForActor, validateAudience } from "@/lib/posts";
import type { Actor } from "@/lib/authz";

const owner: Actor = { class: "INTERNAL", role: "owner", userId: "u1", storeId: "s1", displayName: "O", permissions: new Set() };
const clerk: Actor = { class: "INTERNAL", role: "inventory_clerk", userId: "u2", storeId: "s1", displayName: "C", permissions: new Set() };
const consignor: Actor = { class: "EXTERNAL", role: "consignor", consignorId: "c1", storeId: "s1", displayName: "K", permissions: new Set() };

describe("audience targeting", () => {
  it("EVERYONE reaches staff and consignors alike", () => {
    expect(audienceIncludesActor({ scope: "EVERYONE" }, owner)).toBe(true);
    expect(audienceIncludesActor({ scope: "EVERYONE" }, consignor)).toBe(true);
  });

  it("ALL_INTERNAL reaches staff but NOT consignors", () => {
    expect(audienceIncludesActor({ scope: "ALL_INTERNAL" }, owner)).toBe(true);
    expect(audienceIncludesActor({ scope: "ALL_INTERNAL" }, consignor)).toBe(false);
  });

  it("INTERNAL_ROLE matches only the exact role", () => {
    expect(audienceIncludesActor({ scope: "INTERNAL_ROLE", role: "owner" }, owner)).toBe(true);
    expect(audienceIncludesActor({ scope: "INTERNAL_ROLE", role: "owner" }, clerk)).toBe(false);
  });

  it("ALL_CONSIGNORS reaches consignors but NOT staff", () => {
    expect(audienceIncludesActor({ scope: "ALL_CONSIGNORS" }, consignor)).toBe(true);
    expect(audienceIncludesActor({ scope: "ALL_CONSIGNORS" }, owner)).toBe(false);
  });

  it("a consignor never sees internal-only audiences via the OR builder", () => {
    const or = audienceOrForActor(consignor);
    const scopes = or.map((o) => o.audienceScope);
    expect(scopes).toContain("EVERYONE");
    expect(scopes).toContain("ALL_CONSIGNORS");
    expect(scopes).not.toContain("ALL_INTERNAL");
    expect(scopes).not.toContain("INTERNAL_ROLE");
  });

  it("staff never match a consignor-only audience via the OR builder", () => {
    const or = audienceOrForActor(owner);
    const scopes = or.map((o) => o.audienceScope);
    expect(scopes).not.toContain("ALL_CONSIGNORS");
    expect(scopes).not.toContain("ALL_CUSTOMERS");
  });

  it("TAG matches no one until tags are implemented", () => {
    expect(audienceIncludesActor({ scope: "TAG", tag: "vip" }, owner)).toBe(false);
    expect(audienceIncludesActor({ scope: "TAG", tag: "vip" }, consignor)).toBe(false);
  });

  it("validateAudience requires a role for INTERNAL_ROLE and a tag for TAG", () => {
    expect(validateAudience({ scope: "INTERNAL_ROLE" })).toBeTruthy();
    expect(validateAudience({ scope: "INTERNAL_ROLE", role: "manager" })).toBeNull();
    expect(validateAudience({ scope: "TAG" })).toBeTruthy();
    expect(validateAudience({ scope: "EVERYONE" })).toBeNull();
    expect(validateAudience({ scope: "bogus" as never })).toBeTruthy();
  });
});
