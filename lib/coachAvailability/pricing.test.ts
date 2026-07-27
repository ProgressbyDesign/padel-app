import { describe, expect, it } from "vitest";
import {
  calculateSessionPrice,
  formatMoney,
  resolveSlotPrice,
} from "@/lib/coachAvailability/pricing";

describe("calculateSessionPrice", () => {
  it("calculates 60-minute session at hourly rate", () => {
    expect(calculateSessionPrice(4000, 60)).toBe(4000);
  });

  it("calculates 45-minute session rounded", () => {
    expect(calculateSessionPrice(4000, 45)).toBe(3000);
  });

  it("calculates 90-minute session", () => {
    expect(calculateSessionPrice(4000, 90)).toBe(6000);
  });

  it("returns null without hourly rate", () => {
    expect(calculateSessionPrice(null, 60)).toBeNull();
  });
});

describe("resolveSlotPrice precedence", () => {
  it("prefers exception override when fromException", () => {
    expect(
      resolveSlotPrice({
        durationMinutes: 60,
        currency: "GBP",
        defaultHourlyRateMinor: 4000,
        ruleOverrideMinor: 3500,
        exceptionOverrideMinor: 2500,
        fromException: true,
      })
    ).toEqual({
      priceAmountMinor: 2500,
      currency: "GBP",
      pricingSource: "exception_override",
    });
  });

  it("prefers rule override over hourly", () => {
    expect(
      resolveSlotPrice({
        durationMinutes: 60,
        currency: "EUR",
        defaultHourlyRateMinor: 4000,
        ruleOverrideMinor: 3500,
      })
    ).toEqual({
      priceAmountMinor: 3500,
      currency: "EUR",
      pricingSource: "rule_override",
    });
  });

  it("falls back to calculated hourly", () => {
    expect(
      resolveSlotPrice({
        durationMinutes: 45,
        currency: "GBP",
        defaultHourlyRateMinor: 4000,
      })
    ).toEqual({
      priceAmountMinor: 3000,
      currency: "GBP",
      pricingSource: "default_hourly_rate",
    });
  });

  it("returns null pricing when nothing configured", () => {
    expect(
      resolveSlotPrice({
        durationMinutes: 60,
        currency: null,
        defaultHourlyRateMinor: null,
      })
    ).toEqual({
      priceAmountMinor: null,
      currency: null,
      pricingSource: null,
    });
  });
});

describe("formatMoney", () => {
  it("formats GBP", () => {
    expect(formatMoney(4000, "GBP")).toMatch(/£40\.00/);
  });

  it("formats EUR", () => {
    expect(formatMoney(4000, "EUR")).toMatch(/€40\.00/);
  });

  it("formats SEK with code", () => {
    expect(formatMoney(40000, "SEK")).toMatch(/SEK/);
    expect(formatMoney(40000, "SEK")).toMatch(/400/);
  });

  it("formats AED with code", () => {
    expect(formatMoney(20000, "AED")).toMatch(/AED/);
  });

  it("returns agreed copy for null", () => {
    expect(formatMoney(null, null)).toBe("Price to be agreed with coach");
  });
});
