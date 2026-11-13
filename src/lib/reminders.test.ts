import { describe, it, expect } from "vitest";
import { layawayPeriodsElapsed, nextLayawayPayment, isDaytime } from "@/lib/reminders";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86400000);
const start = day(0);

describe("layaway reminders — every 14 days", () => {
  it("counts full 14-day periods since the start", () => {
    expect(layawayPeriodsElapsed(start, day(0))).toBe(0);
    expect(layawayPeriodsElapsed(start, day(13))).toBe(0);
    expect(layawayPeriodsElapsed(start, day(14))).toBe(1);
    expect(layawayPeriodsElapsed(start, day(27))).toBe(1);
    expect(layawayPeriodsElapsed(start, day(28))).toBe(2);
    expect(layawayPeriodsElapsed(start, day(70))).toBe(5);
  });

  it("never goes negative for a future start date", () => {
    expect(layawayPeriodsElapsed(day(10), day(0))).toBe(0);
  });
});

describe("next layaway payment", () => {
  const base = { totalPrice: 200, deposit: 50, payment2: 50, payment3: 50, finalPayment: 50, startDate: start };

  it("points at Payment 2 once the deposit is paid", () => {
    const n = nextLayawayPayment({ ...base, amountPaid: 50 }, day(14));
    expect(n.which).toMatch(/^Payment 2 — due /);
    expect(n.amount).toBe(50);
    expect(n.balance).toBe(150);
  });

  it("says a missed payment WAS due, and asks for the shortfall", () => {
    const n = nextLayawayPayment({ ...base, amountPaid: 70 }, day(28));
    expect(n.which).toMatch(/^Payment 2 — was due /);
    expect(n.amount).toBe(30); // 100 scheduled by then − 70 paid
    expect(n.balance).toBe(130);
  });

  it("moves on to the final payment", () => {
    const n = nextLayawayPayment({ ...base, amountPaid: 150 }, day(42));
    expect(n.which).toMatch(/^Final payment — due /);
    expect(n.amount).toBe(50);
  });

  it("falls back to the remaining balance when no schedule was entered", () => {
    const n = nextLayawayPayment({ totalPrice: 120, amountPaid: 20, deposit: 0, payment2: 0, payment3: 0, finalPayment: 0, startDate: start }, day(14));
    expect(n.which).toBe("Remaining balance");
    expect(n.amount).toBe(100);
  });

  it("never asks for more than the balance", () => {
    const n = nextLayawayPayment({ ...base, totalPrice: 60, amountPaid: 50 }, day(14));
    expect(n.amount).toBe(10);
  });
});

describe("automatic emails only go out in the daytime (store time)", () => {
  it("allows 10am and blocks 3am / 9pm Eastern", () => {
    expect(isDaytime(new Date("2026-06-15T14:00:00Z"), "America/New_York")).toBe(true);  // 10am EDT
    expect(isDaytime(new Date("2026-06-15T07:00:00Z"), "America/New_York")).toBe(false); // 3am EDT
    expect(isDaytime(new Date("2026-06-16T01:00:00Z"), "America/New_York")).toBe(false); // 9pm EDT
  });
  it("falls back safely on a bad timezone", () => {
    expect(typeof isDaytime(new Date(), "Not/AZone")).toBe("boolean");
  });
});
