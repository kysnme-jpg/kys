import { describe, it, expect } from "vitest";
import { dayRange, todayIn, isDateKey, shiftDay } from "./day-range";

const NY = "America/New_York";

describe("dayRange", () => {
  it("starts at local midnight in winter (UTC−5)", () => {
    const { start, end } = dayRange("2026-11-20", NY);
    expect(start.toISOString()).toBe("2026-11-20T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-21T05:00:00.000Z");
  });

  it("starts at local midnight in summer (UTC−4)", () => {
    expect(dayRange("2026-07-04", NY).start.toISOString()).toBe("2026-07-04T04:00:00.000Z");
  });

  it("handles the day the clocks go back (25 hours)", () => {
    const { start, end } = dayRange("2026-11-01", NY);
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("handles the day the clocks go forward (23 hours)", () => {
    const { start, end } = dayRange("2026-03-08", NY);
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("falls back to New York for an unknown zone", () => {
    expect(dayRange("2026-11-20", "Not/AZone").start.toISOString()).toBe("2026-11-20T05:00:00.000Z");
  });
});

describe("todayIn", () => {
  it("is still yesterday in Baltimore late in the UTC night", () => {
    expect(todayIn(NY, new Date("2026-11-21T03:30:00Z"))).toBe("2026-11-20");
  });
});

describe("isDateKey / shiftDay", () => {
  it("accepts real dates only", () => {
    expect(isDateKey("2026-11-20")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("11/20/2026")).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
  it("moves across month ends", () => {
    expect(shiftDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});
