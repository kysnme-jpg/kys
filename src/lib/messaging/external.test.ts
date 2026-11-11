import { describe, it, expect } from "vitest";
import { resolveExternalRecipient } from "@/lib/messaging/external";

describe("external recipient resolver (§4a Layer 6)", () => {
  it("accepts a consignor-only recipient", () => {
    expect(resolveExternalRecipient({ consignorId: "c1" })).toEqual({
      externalClass: "CONSIGNOR", consignorId: "c1", customerId: null,
    });
  });

  it("accepts a customer-only recipient", () => {
    expect(resolveExternalRecipient({ customerId: "cu1" })).toEqual({
      externalClass: "CUSTOMER", consignorId: null, customerId: "cu1",
    });
  });

  it("REJECTS a mixed-class recipient (consignor + customer)", () => {
    expect(() => resolveExternalRecipient({ consignorId: "c1", customerId: "cu1" })).toThrow();
  });

  it("REJECTS an empty recipient", () => {
    expect(() => resolveExternalRecipient({})).toThrow();
    expect(() => resolveExternalRecipient({ consignorId: null, customerId: null })).toThrow();
  });
});
