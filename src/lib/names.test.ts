import { describe, it, expect } from "vitest";
import { splitName, joinName, resolveName } from "@/lib/names";

describe("names", () => {
  it("splits at the last space", () => {
    expect(splitName("Wisdom Miles")).toEqual({ firstName: "Wisdom", lastName: "Miles" });
    expect(splitName("Mary Ann Smith")).toEqual({ firstName: "Mary Ann", lastName: "Smith" });
    expect(splitName("  Extra   Spaces  Jones ")).toEqual({ firstName: "Extra Spaces", lastName: "Jones" });
  });
  it("treats a single word as a first name, and handles empty input", () => {
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitName(null)).toEqual({ firstName: "", lastName: "" });
  });
  it("joins and tidies", () => {
    expect(joinName(" Wisdom ", " Miles ")).toBe("Wisdom Miles");
    expect(joinName("Cher", "")).toBe("Cher");
    expect(joinName("", "Miles")).toBe("Miles");
  });
  it("prefers separate fields, falls back to a full name", () => {
    expect(resolveName({ firstName: "Wisdom", lastName: "Miles", full: "Ignored Name" })).toEqual({ firstName: "Wisdom", lastName: "Miles", full: "Wisdom Miles" });
    expect(resolveName({ full: "Mary Ann Smith" })).toEqual({ firstName: "Mary Ann", lastName: "Smith", full: "Mary Ann Smith" });
    expect(resolveName({}).firstName).toBe("");
  });
});
