import { describe, it, expect } from "vitest";
import { splitFees, describeFees } from "./item-fees";

describe("splitFees", () => {
  it("divides each charge evenly across pieces", () => {
    const out = splitFees([{ label: "Cleaning", amount: 25 }], 5);
    expect(out.map((p) => p[0].amount)).toEqual([5, 5, 5, 5, 5]);
  });

  it("puts leftover cents on the first pieces so the total is exact", () => {
    const out = splitFees([{ label: "Authentication", amount: 10 }], 3);
    const amounts = out.map((p) => p[0].amount);
    expect(amounts).toEqual([3.34, 3.33, 3.33]);
    expect(Math.round(amounts.reduce((a, b) => a + b, 0) * 100)).toBe(1000);
  });

  it("drops a piece's share when it rounds to nothing", () => {
    const out = splitFees([{ label: "Tag", amount: 0.02 }], 3);
    expect(out.map((p) => p.length)).toEqual([1, 1, 0]);
  });

  it("keeps several charges separate", () => {
    const out = splitFees([{ label: "A", amount: 4 }, { label: "B", amount: 2 }], 2);
    expect(out[0]).toEqual([{ label: "A", amount: 2 }, { label: "B", amount: 1 }]);
  });
});

describe("describeFees", () => {
  it("lists charges with amounts", () => {
    expect(describeFees([{ label: "Dry cleaning", amount: 15 }, { label: "Alterations", amount: 7.5 }])).toBe("Dry cleaning $15.00, Alterations $7.50");
  });
});
